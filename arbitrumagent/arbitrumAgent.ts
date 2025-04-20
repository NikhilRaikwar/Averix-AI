import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, END } from "@langchain/langgraph";
import { HumanMessage, AIMessage, BaseMessage, SystemMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import express, { Request, Response, RequestHandler } from "express";
import bodyParser from "body-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import { Logger } from "tslog";
import cors from "cors";

dotenv.config();

// Environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || "";
const DEXSCREENER_API_KEY = process.env.DEXSCREENER_API_KEY || "";
const ARBITRUM_RPC_URL = process.env.ARBITRUM_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
const ARBITRUM_EXPLORER_URL = "https://sepolia.arbiscan.io";
const ARBITRUM_FAUCET_URL = "https://faucet.triangleplatform.com/arbitrum/sepolia";

// Logger setup
const log = new Logger({ name: "ArbitrumAgent" });

// ERC-20 ABI for interacting with deployed tokens
const ERC20_ABI = [
  "function transfer(address to, uint256 value) public returns (bool)",
  "function balanceOf(address account) public view returns (uint256)",
  "function burn(uint256 value) public returns (bool)",
];

// Token name to address mapping (in-memory storage for simplicity)
const tokenMap: { [name: string]: string } = {};

// Initialize OpenAI model
const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  apiKey: OPENAI_API_KEY,
  temperature: 0,
});

// Blockchain tools
class BlockchainTools {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet | null = null;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  getWallet(): ethers.Wallet | null {
    return this.wallet;
  }

  setWallet(wallet: ethers.Wallet): void {
    this.wallet = wallet;
    log.info(`Wallet set to address: ${wallet.address}`);
  }

  clearWallet(): void {
    this.wallet = null;
    log.info("Wallet cleared from memory");
  }
}

// Define tools
class SetWalletTool extends StructuredTool {
  schema = z.object({
    privateKey: z.string().describe("The private key to set the wallet"),
  });

  name = "setWallet";
  description = "Set the wallet using a private key. Stays until explicitly disconnected.";

  constructor(private tools: BlockchainTools) {
    super();
  }

  async _call({ privateKey }: { privateKey: string }) {
    try {
      const wallet = new ethers.Wallet(privateKey, this.tools.getProvider());
      this.tools.setWallet(wallet);
      log.info(`Wallet set to address: ${wallet.address}`);
      return `Wallet set to address: ${wallet.address}`;
    } catch (error) {
      log.error("SetWalletTool error:", error);
      throw new Error(`Failed to set wallet: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

class DisconnectWalletTool extends StructuredTool {
  schema = z.object({});

  name = "disconnectWallet";
  description = "Disconnect the current wallet and clear it from memory";

  constructor(private tools: BlockchainTools) {
    super();
  }

  async _call() {
    this.tools.clearWallet();
    return "Wallet disconnected successfully";
  }
}

class GetWalletAddressTool extends StructuredTool {
  schema = z.object({});

  name = "getWalletAddress";
  description = "Get the current wallet address";

  constructor(private tools: BlockchainTools) {
    super();
  }

  async _call() {
    const wallet = this.tools.getWallet();
    if (!wallet) return "No wallet set. Please provide a private key.";
    return wallet.address;
  }
}

class GetBalanceTool extends StructuredTool {
  schema = z.object({});

  name = "getBalance";
  description = "Get the ETH balance and balances of created ERC-20 tokens on Arbitrum";

  constructor(private tools: BlockchainTools) {
    super();
  }

  async _call() {
    const wallet = this.tools.getWallet();
    if (!wallet) return "No wallet set.";

    const balances: string[] = [];
    // ETH balance
    const ethBalance = await this.tools.getProvider().getBalance(wallet.address);
    balances.push(`ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);

    // ERC-20 token balances
    for (const [tokenName, tokenAddress] of Object.entries(tokenMap)) {
      try {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.tools.getProvider());
        const balance = await tokenContract.balanceOf(wallet.address);
        balances.push(`${tokenName} Balance: ${ethers.formatUnits(balance, 0)} ${tokenName}`);
      } catch (error) {
        log.error(`Error fetching balance for ${tokenName}:`, error);
        balances.push(`${tokenName} Balance: Unable to fetch`);
      }
    }

    return balances.length > 0 ? balances.join("\n") : "No balances available.";
  }
}

class TransferTokensTool extends StructuredTool {
  schema = z.object({
    to: z.string().describe("The recipient address"),
    amount: z.string().describe("The amount of ETH to transfer"),
  });

  name = "transferTokens";
  description = "Transfer ETH tokens to an address on Arbitrum";

  constructor(private tools: BlockchainTools) {
    super();
  }

  async _call({ to, amount }: { to: string; amount: string }) {
    const wallet = this.tools.getWallet();
    if (!wallet) return "No wallet set.";
    try {
      const tx = { to, value: ethers.parseEther(amount) };
      const txResponse = await wallet.sendTransaction(tx);
      await txResponse.wait();
      log.info(`Transfer: ${amount} ETH to ${to}, Tx: ${txResponse.hash}`);
      return `Transferred ${amount} ETH to ${to}. Tx: ${ARBITRUM_EXPLORER_URL}/tx/${txResponse.hash}`;
    } catch (error) {
      log.error("TransferTokensTool error:", error);
      throw new Error(`Failed to transfer tokens: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

class SignMessageTool extends StructuredTool {
  schema = z.object({
    message: z.string().describe("The message to sign"),
  });

  name = "signMessage";
  description = "Sign a message with the wallet";

  constructor(private tools: BlockchainTools) {
    super();
  }

  async _call({ message }: { message: string }) {
    const wallet = this.tools.getWallet();
    if (!wallet) return "No wallet set.";
    try {
      const signature = await wallet.signMessage(message);
      return `Message signed: ${signature}`;
    } catch (error) {
      log.error("SignMessageTool error:", error);
      throw new Error(`Failed to sign message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

class GetTransactionHistoryTool extends StructuredTool {
  schema = z.object({
    count: z.number().optional().default(5).describe("Number of transactions to fetch"),
  });

  name = "getTransactionHistory";
  description = "Get recent transaction history with explorer links on Arbitrum";

  constructor(private tools: BlockchainTools) {
    super();
  }

  async _call({ count }: { count: number }) {
    const wallet = this.tools.getWallet();
    if (!wallet) return "No wallet set.";
    const provider = this.tools.getProvider();
    const blockNumber = await provider.getBlockNumber();
    const fromBlock = Math.max(blockNumber - 99, 0);
    const filter = { fromBlock, toBlock: blockNumber, address: wallet.address };
    try {
      const logs = await provider.getLogs(filter);
      const recentTxs = logs.slice(0, count).map((log) => ({
        hash: `${ARBITRUM_EXPLORER_URL}/tx/${log.transactionHash}`,
        blockNumber: log.blockNumber,
        data: log.data,
      }));
      return `Recent ${count} transactions:\n${JSON.stringify(recentTxs, null, 2)}`;
    } catch (error) {
      log.error("GetTransactionHistoryTool error:", error);
      return `Failed to fetch transaction history: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

class GetGasPriceTool extends StructuredTool {
  schema = z.object({});

  name = "getGasPrice";
  description = "Estimate current gas price on Arbitrum";

  constructor(private tools: BlockchainTools) {
    super();
  }

  async _call() {
    const feeData = await this.tools.getProvider().getFeeData();
    const gasPrice = feeData.gasPrice;
    if (!gasPrice) return "Unable to fetch gas price.";
    return `Current gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`;
  }
}

class GetTokenPriceTool extends StructuredTool {
  schema = z.object({
    token: z.string().describe("Token ticker (e.g., ETH)"),
  });

  name = "getTokenPrice";
  description = "Get real-time token price from CoinGecko";

  async _call({ token }: { token: string }) {
    try {
      const response = await axios.get<{ [key: string]: { usd: number } }>(
        `https://api.coingecko.com/api/v3/simple/price?ids=${token.toLowerCase()}&vs_currencies=usd`,
        { headers: { "x-cg-api-key": COINGECKO_API_KEY } }
      );
      const price = response.data[token.toLowerCase()]?.usd;
      if (!price) return `Price not found for ${token}`;
      return `Price of ${token}: $${price} USD`;
    } catch (error) {
      log.error("GetTokenPriceTool error:", error);
      throw new Error(`Failed to fetch price: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

class GetTrendingTokensTool extends StructuredTool {
  schema = z.object({});

  name = "getTrendingTokens";
  description = "Get trending tokens (mocked for Arbitrum Sepolia as explorer may not list tokens)";

  async _call() {
    try {
      const mockTokens = [
        { token: "TEST1", price: "$0.05" },
        { token: "TEST2", price: "$0.10" },
      ];
      return `Trending tokens on Arbitrum Sepolia (mocked):\n${JSON.stringify(mockTokens, null, 2)}`;
    } catch (error) {
      log.error("GetTrendingTokensTool error:", error);
      return `Failed to fetch trending tokens: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

class CreateTokenTool extends StructuredTool {
  schema = z.object({
    name: z.string().describe("The name of the token"),
    symbol: z.string().describe("The symbol of the token"),
    totalSupply: z.string().describe("The total supply of the token (in whole units, e.g., 1000 for 1000 tokens)"),
  });

  name = "createToken";
  description = "Create a new ERC-20 token on the Arbitrum Sepolia testnet with burn functionality";

  constructor(private tools: BlockchainTools) {
    super();
  }

  // Token ABI placeholder (to be filled by user)
  TOKEN_ABI = [
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "name_",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "symbol_",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "initialSupply_",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "owner",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "spender",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "Approval",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "spender",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "approve",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "burn",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "burner",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "Burn",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "transfer",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "Transfer",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "transferFrom",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "spender",
          "type": "address"
        }
      ],
      "name": "allowance",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "account",
          "type": "address"
        }
      ],
      "name": "balanceOf",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "decimals",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "name",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "symbol",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "totalSupply",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ];

  // Token Bytecode placeholder (to be filled by user)
  TOKEN_BYTECODE = "0x608060405234801561000f575f80fd5b5060405161199c38038061199c833981810160405281019061003191906102a4565b825f908161003f9190610530565b50816001908161004f9190610530565b505f60025f6101000a81548160ff021916908360ff1602179055508060038190555060035460045f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20819055503373ffffffffffffffffffffffffffffffffffffffff165f73ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef600354604051610114919061060e565b60405180910390a3505050610627565b5f604051905090565b5f80fd5b5f80fd5b5f80fd5b5f80fd5b5f601f19601f8301169050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52604160045260245ffd5b6101838261013d565b810181811067ffffffffffffffff821117156101a2576101a161014d565b5b80604052505050565b5f6101b4610124565b90506101c0828261017a565b919050565b5f67ffffffffffffffff8211156101df576101de61014d565b5b6101e88261013d565b9050602081019050919050565b8281835e5f83830152505050565b5f610215610210846101c5565b6101ab565b90508281526020810184848401111561023157610230610139565b5b61023c8482856101f5565b509392505050565b5f82601f83011261025857610257610135565b5b8151610268848260208601610203565b91505092915050565b5f819050919050565b61028381610271565b811461028d575f80fd5b50565b5f8151905061029e8161027a565b92915050565b5f805f606084860312156102bb576102ba61012d565b5b5f84015167ffffffffffffffff8111156102d8576102d7610131565b5b6102e486828701610244565b935050602084015167ffffffffffffffff81111561030557610304610131565b5b61031186828701610244565b925050604061032286828701610290565b9150509250925092565b5f81519050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f600282049050600182168061037a57607f821691505b60208210810361038d5761038c610336565b5b50919050565b5f819050815f5260205f209050919050565b5f6020601f8301049050919050565b5f82821b905092915050565b5f600883026103ef7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff826103b4565b6103f986836103b4565b95508019841693508086168417925050509392505050565b5f819050919050565b5f61043461042f61042a84610271565b610411565b610271565b9050919050565b5f819050919050565b61044d8361041a565b6104616104598261043b565b8484546103c0565b825550505050565b5f90565b610475610469565b610480818484610444565b505050565b5b818110156104a3576104985f8261046d565b600181019050610486565b5050565b601f8211156104e8576104b981610393565b6104c2846103a5565b810160208510156104d1578190505b6104e56104dd856103a5565b830182610485565b50505b505050565b5f82821c905092915050565b5f6105085f19846008026104ed565b1980831691505092915050565b5f61052083836104f9565b9150826002028217905092915050565b6105398261032c565b67ffffffffffffffff8111156105525761055161014d565b5b61055c8254610363565b6105678282856104a7565b5f60209050601f831160018114610598575f8415610586578287015190505b6105908582610515565b8655506105f7565b601f1984166105a686610393565b5f5b828110156105cd578489015182556001820191506020850194506020810190506105a8565b868310156105ea57848901516105e6601f8916826104f9565b8355505b6001600288020188555050505b505050505050565b61060881610271565b82525050565b5f6020820190506106215f8301846105ff565b92915050565b611368806106345f395ff3fe608060405234801561000f575f80fd5b506004361061009c575f3560e01c806342966c681161006457806342966c681461015a57806370a082311461018a57806395d89b41146101ba578063a9059cbb146101d8578063dd62ed3e146102085761009c565b806306fdde03146100a0578063095ea7b3146100be57806318160ddd146100ee57806323b872dd1461010c578063313ce5671461013c575b5f80fd5b6100a8610238565b6040516100b59190610d70565b60405180910390f35b6100d860048036038101906100d39190610e21565b6102c7565b6040516100e59190610e79565b60405180910390f35b6100f6610422565b6040516101039190610ea1565b60405180910390f35b61012660048036038101906101219190610eba565b61042b565b6040516101339190610e79565b60405180910390f35b6101446107e7565b6040516101519190610f25565b60405180910390f35b610174600480360381019061016f9190610f3e565b6107fc565b6040516101819190610e79565b60405180910390f35b6101a4600480360381019061019f9190610f69565b6109a4565b6040516101b19190610ea1565b60405180910390f35b6101c26109ea565b6040516101cf9190610d70565b60405180910390f35b6101f260048036038101906101ed9190610e21565b610a7a565b6040516101ff9190610e79565b60405180910390f35b610222600480360381019061021d9190610f94565b610c7e565b60405161022f9190610ea1565b60405180910390f35b60605f805461024690610fff565b80601f016020809104026020016040519081016040528092919081815260200182805461027290610fff565b80156102bd5780601f10610294576101008083540402835291602001916102bd565b820191905f5260205f20905b8154815290600101906020018083116102a057829003601f168201915b5050505050905090565b5f8073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603610336576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161032d90611079565b60405180910390fd5b8160055f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925846040516104109190610ea1565b60405180910390a36001905092915050565b5f600354905090565b5f8073ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff160361049a576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610491906110e1565b60405180910390fd5b5f73ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603610508576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104ff90611149565b60405180910390fd5b8160045f8673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20541015610588576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161057f906111b1565b60405180910390fd5b8160055f8673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20541015610643576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161063a90611219565b60405180910390fd5b8160045f8673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f82825461068f9190611264565b925050819055508160045f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8282546106e29190611297565b925050819055508160055f8673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8282546107709190611264565b925050819055508273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040516107d49190610ea1565b60405180910390a3600190509392505050565b5f60025f9054906101000a900460ff16905090565b5f8160045f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f2054101561087d576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161087490611314565b60405180910390fd5b8160045f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8282546108c99190611264565b925050819055508160035f8282546108e19190611264565b925050819055503373ffffffffffffffffffffffffffffffffffffffff167fcc16f5dbb4873280815c1ee09dbd06736cffcc184412cf7a71a0fdb75d397ca58360405161092e9190610ea1565b60405180910390a25f73ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040516109939190610ea1565b60405180910390a360019050919050565b5f60045f8373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20549050919050565b6060600180546109f990610fff565b80601f0160208091040260200160405190810160405280929190818152602001828054610a2590610fff565b8015610a705780601f10610a4757610100808354040283529160200191610a70565b820191905f5260205f20905b815481529060010190602001808311610a5357829003601f168201915b5050505050905090565b5f8073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603610ae9576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610ae090611149565b60405180910390fd5b8160045f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20541015610b69576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610b60906111b1565b60405180910390fd5b8160045f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f828254610bb59190611264565b925050819055508160045f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f828254610c089190611297565b925050819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef84604051610c6c9190610ea1565b60405180910390a36001905092915050565b5f60055f8473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f2054905092915050565b5f81519050919050565b5f82825260208201905092915050565b8281835e5f83830152505050565b5f601f19601f8301169050919050565b5f610d4282610d00565b610d4c8185610d0a565b9350610d5c818560208601610d1a565b610d6581610d28565b840191505092915050565b5f6020820190508181035f830152610d888184610d38565b905092915050565b5f80fd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f610dbd82610d94565b9050919050565b610dcd81610db3565b8114610dd7575f80fd5b50565b5f81359050610de881610dc4565b92915050565b5f819050919050565b610e0081610dee565b8114610e0a575f80fd5b50565b5f81359050610e1b81610df7565b92915050565b5f8060408385031215610e3757610e36610d90565b5b5f610e4485828601610dda565b9250506020610e5585828601610e0d565b9150509250929050565b5f8115159050919050565b610e7381610e5f565b82525050565b5f602082019050610e8c5f830184610e6a565b92915050565b610e9b81610dee565b82525050565b5f602082019050610eb45f830184610e92565b92915050565b5f805f60608486031215610ed157610ed0610d90565b5b5f610ede86828701610dda565b9350506020610eef86828701610dda565b9250506040610f0086828701610e0d565b9150509250925092565b5f60ff82169050919050565b610f1f81610f0a565b82525050565b5f602082019050610f385f830184610f16565b92915050565b5f60208284031215610f5357610f52610d90565b5b5f610f6084828501610e0d565b91505092915050565b5f60208284031215610f7e57610f7d610d90565b5b5f610f8b84828501610dda565b91505092915050565b5f8060408385031215610faa57610fa9610d90565b5b5f610fb785828601610dda565b9250506020610fc885828601610dda565b9150509250929050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f600282049050600182168061101657607f821691505b60208210810361102957611028610fd2565b5b50919050565b7f496e76616c6964207370656e64657220616464726573730000000000000000005f82015250565b5f611063601783610d0a565b915061106e8261102f565b602082019050919050565b5f6020820190508181035f83015261109081611057565b9050919050565b7f496e76616c69642073656e6465722061646472657373000000000000000000005f82015250565b5f6110cb601683610d0a565b91506110d682611097565b602082019050919050565b5f6020820190508181035f8301526110f8816110bf565b9050919050565b7f496e76616c696420726563697069656e742061646472657373000000000000005f82015250565b5f611133601983610d0a565b915061113e826110ff565b602082019050919050565b5f6020820190508181035f83015261116081611127565b9050919050565b7f496e73756666696369656e742062616c616e63650000000000000000000000005f82015250565b5f61119b601483610d0a565b91506111a682611167565b602082019050919050565b5f6020820190508181035f8301526111c88161118f565b9050919050565b7f496e73756666696369656e7420616c6c6f77616e6365000000000000000000005f82015250565b5f611203601683610d0a565b915061120e826111cf565b602082019050919050565b5f6020820190508181035f830152611230816111f7565b9050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f61126e82610dee565b915061127983610dee565b925082820390508181111561129157611290611237565b5b92915050565b5f6112a182610dee565b91506112ac83610dee565b92508282019050808211156112c4576112c3611237565b5b92915050565b7f496e73756666696369656e742062616c616e636520746f206275726e000000005f82015250565b5f6112fe601c83610d0a565b9150611309826112ca565b602082019050919050565b5f6020820190508181035f83015261132b816112f2565b905091905056fea2646970667358221220fb940003040f153c2377b7b4e01cba82ec8c14120f8c7aff05bd60e539f5ecf064736f6c634300081a0033";

  async _call({ name, symbol, totalSupply }: { name: string; symbol: string; totalSupply: string }) {
    const wallet = this.tools.getWallet();
    if (!wallet) return "No wallet set. Please set a wallet first.";

    const factory = new ethers.ContractFactory(this.TOKEN_ABI, this.TOKEN_BYTECODE, wallet);

    try {
      const totalSupplyNum = parseInt(totalSupply);
      if (isNaN(totalSupplyNum) || totalSupplyNum <= 0) {
        throw new Error("Invalid total supply: must be a positive number");
      }
      const contract = await factory.deploy(name, symbol, totalSupplyNum);
      await contract.waitForDeployment();
      const contractAddress = await contract.getAddress();
      tokenMap[symbol] = contractAddress;
      log.info(`Token ${name} (${symbol}) created at: ${contractAddress}`);
      return `Token ${name} (${symbol}) created successfully at ${ARBITRUM_EXPLORER_URL}/address/${contractAddress}`;
    } catch (error) {
      log.error("CreateTokenTool error:", error);
      throw new Error(`Failed to create token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

class GetFaucetTokensTool extends StructuredTool {
  schema = z.object({
    address: z.string().describe("The wallet address to receive testnet ETH"),
  });

  name = "getFaucetTokens";
  description = "Request testnet ETH from the Arbitrum faucet";

  async _call({ address }: { address: string }) {
    try {
      if (!ethers.isAddress(address)) {
        return "Invalid Ethereum address provided.";
      }
      return `To get testnet ETH for ${address}, visit ${ARBITRUM_FAUCET_URL}, paste your address (${address}), and follow the instructions to claim tokens.`;
    } catch (error) {
      log.error("GetFaucetTokensTool error:", error);
      return `Failed to process faucet request: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

class BatchMixedTransferTool extends StructuredTool {
  schema = z.object({
    transfers: z
      .string()
      .describe(
        "A space-separated list of mixed transfers in the format '<type1> <to1> <amount1> [tokenName1] <type2> <to2> <amount2> [tokenName2]'. " +
        "Use 'ETH' for native tokens or 'TOKEN' for ERC-20 tokens with token name (e.g., 'ETH 0x123... 0.01 TOKEN 0x456... 10 ATK')"
      ),
  });

  name = "batchMixedTransfer";
  description =
    "Transfer ETH and ERC-20 tokens in a single batch using token names. Format: batchMixedTransfer <type1> <to1> <amount1> [tokenName1] <type2> <to2> <amount2> [tokenName2] ...";

  constructor(private tools: BlockchainTools) {
    super();
  }

  async _call({ transfers }: { transfers: string }) {
    const wallet = this.tools.getWallet();
    if (!wallet) return "No wallet set. Please set a wallet with 'setWallet <privateKey>' first.";

    const parts = transfers.trim().split(" ");
    if (parts.length < 3) {
      return "Invalid format. Use: batchMixedTransfer <type1> <to1> <amount1> [tokenName1] <type2> <to2> <amount2> [tokenName2] ...";
    }

    const transferList: { type: string; to: string; amount: string; tokenName?: string }[] = [];
    for (let i = 0; i < parts.length; i += 3) {
      const type = parts[i].toUpperCase();
      const to = parts[i + 1];
      const amount = parts[i + 2];
      let tokenName: string | undefined;

      if (type === "TOKEN") {
        if (i + 3 >= parts.length) {
          return `Missing token name for TOKEN transfer at position ${i / 3 + 1}`;
        }
        tokenName = parts[i + 3];
        if (!tokenMap[tokenName]) {
          return `Token ${tokenName} not found. Please create it first using createToken.`;
        }
        i++;
      } else if (type !== "ETH") {
        return `Invalid type: ${type}. Use 'ETH' or 'TOKEN'`;
      }

      if (!ethers.isAddress(to)) return `Invalid address: ${to}`;
      if (isNaN(Number(amount)) || Number(amount) <= 0) return `Invalid amount: ${amount}`;
      transferList.push({ type, to, amount, tokenName });
    }

    const results: string[] = [];
    let nonce = await wallet.getNonce();

    for (const [index, { type, to, amount, tokenName }] of transferList.entries()) {
      try {
        if (type === "ETH") {
          const tx = {
            to,
            value: ethers.parseEther(amount),
            nonce,
          };
          const txResponse = await wallet.sendTransaction(tx);
          const receipt = await txResponse.wait();
          if (receipt && receipt.hash) {
            log.info(`ETH Transfer: ${amount} to ${to}, Tx: ${receipt.hash}`);
            results.push(
              `${index + 1}. **ETH Transfer to ${to}**:\n   - Amount: ${amount} ETH\n   - Status: Successful\n   - Transaction Link: [View Transaction](${ARBITRUM_EXPLORER_URL}/tx/${receipt.hash})`
            );
          } else {
            throw new Error("Transaction receipt is null or invalid");
          }
        } else if (type === "TOKEN" && tokenName) {
          const tokenAddress = tokenMap[tokenName];
          const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
          const amountWei = ethers.parseUnits(amount, 0);
          const tx = await tokenContract.transfer(to, amountWei, { nonce });
          const receipt = await tx.wait();
          if (receipt && receipt.hash) {
            log.info(`Token Transfer: ${amount} ${tokenName} to ${to}, Tx: ${receipt.hash}`);
            results.push(
              `${index + 1}. **${tokenName} Transfer to ${to}**:\n   - Amount: ${amount} ${tokenName}\n   - Status: Successful\n   - Transaction Link: [View Transaction](${ARBITRUM_EXPLORER_URL}/tx/${receipt.hash})`
            );
          } else {
            throw new Error("Transaction receipt is null or invalid");
          }
        }
        nonce++;
      } catch (error) {
        log.error(`Transfer to ${to} failed:`, error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push(
          `${index + 1}. **${type === "ETH" ? "ETH" : tokenName} Transfer to ${to}**:\n   - Amount: ${amount} ${type === "ETH" ? "ETH" : tokenName}\n   - Status: Failed\n   - Error: ${errorMsg}`
        );
      }
    }

    const summary = `The batch mixed transfer completed with ${results.length} operations:\n\n${results.join("\n\n")}`;
    log.info(summary);
    return summary;
  }
}

class HelpTool extends StructuredTool {
  schema = z.object({});

  name = "help";
  description = "List all available commands";

  async _call() {
    const commands = [
      "setWallet <privateKey> - Set your wallet",
      "disconnectWallet - Disconnect and clear your wallet",
      "getWalletAddress - Get your wallet address",
      "getBalance - Check your ETH and token balances",
      "transferTokens <to> <amount> - Transfer ETH tokens",
      "signMessage <message> - Sign a message",
      "getTransactionHistory [count] - Get recent transactions (default 5)",
      "getGasPrice - Get current gas price",
      "getTokenPrice <token> - Get token price (e.g., ETH)",
      "getTrendingTokens - Get trending tokens (mocked for Arbitrum)",
      "createToken <name> <symbol> <totalSupply> - Create a new token",
      "getFaucetTokens <address> - Request testnet ETH from Arbitrum faucet",
      "batchMixedTransfer <type1> <to1> <amount1> [tokenName1] <type2> <to2> <amount2> [tokenName2] - Transfer ETH and tokens",
      "help - Show this list",
    ];
    return `Available commands:\n${commands.join("\n")}`;
  }
}

// Instantiate tools
const blockchainTools = new BlockchainTools();
const tools = [
  new SetWalletTool(blockchainTools),
  new DisconnectWalletTool(blockchainTools),
  new GetWalletAddressTool(blockchainTools),
  new GetBalanceTool(blockchainTools),
  new TransferTokensTool(blockchainTools),
  new SignMessageTool(blockchainTools),
  new GetTransactionHistoryTool(blockchainTools),
  new GetGasPriceTool(blockchainTools),
  new GetTokenPriceTool(),
  new GetTrendingTokensTool(),
  new CreateTokenTool(blockchainTools),
  new GetFaucetTokensTool(),
  new BatchMixedTransferTool(blockchainTools),
  new HelpTool(),
];

const toolNode = new ToolNode(tools);
const modelWithTools = llm.bindTools(tools);

// Define state
interface AgentState {
  messages: BaseMessage[];
}

// Agent logic
async function callAgent(state: AgentState): Promise<Partial<AgentState>> {
  const systemMessage = new SystemMessage(
    "You are an AI assistant that helps users interact with the Arbitrum Sepolia testnet. Use the provided tools to assist the user. The wallet private key persists until the user explicitly disconnects."
  );
  const messagesWithSystem = [systemMessage, ...state.messages];
  const response = await modelWithTools.invoke(messagesWithSystem);
  return { messages: [response] };
}

function shouldContinue(state: AgentState): string {
  const lastMessage = state.messages[state.messages.length - 1];
  if ("tool_calls" in lastMessage && Array.isArray(lastMessage.tool_calls) && lastMessage.tool_calls.length > 0) {
    return "tools";
  }
  return END;
}

// Define workflow
const workflow = new StateGraph<AgentState>({
  channels: {
    messages: {
      reducer: (x?: BaseMessage[], y?: BaseMessage[]) => (x ?? []).concat(y ?? []),
      default: () => [],
    },
  },
})
  .addNode("agent", callAgent)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addEdge("tools", "agent")
  .addConditionalEdges("agent", shouldContinue);

const agent = workflow.compile();

const app = express();

// Define agentHandler
const agentHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  const { input, privateKey } = req.body as { input?: string; privateKey?: string };
  if (!input) {
    res.status(400).json({ error: "Input is required" });
    return;
  }

  try {
    const messages: BaseMessage[] = [];
    if (privateKey) {
      messages.push(new HumanMessage(`setWallet ${privateKey}`));
    }
    messages.push(new HumanMessage(input));

    const result = await agent.invoke({ messages });
    const lastMessage = result.messages[result.messages.length - 1];
    res.json({ response: lastMessage.content });
  } catch (error) {
    log.error("Agent handler error:", error);
    res.status(500).json({ error: `Internal server error: ${error instanceof Error ? error.message : String(error)}` });
  }
};

// Setup Express with CORS and routes
app.use(cors({ origin: "" }));
app.use(bodyParser.json());
app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Welcome to Arbitrum AI Agent! Use POST /agent to interact with the agent." });
});
app.post("/agent", agentHandler);

const PORT = 3000;
app.listen(PORT, () => {
  log.info(`Server running on http://localhost:${PORT}`);
});