<div align="center">

# Averix | Arbitrum AI Agent

![Averix](https://github.com/user-attachments/assets/2aa32a99-96b2-47bb-9f92-27c643aec9ad)


</div>

Welcome to **Averix | Arbitrum AI Agent**—an open-source, AI-powered assistant crafted to supercharge your interactions with the Arbitrum Sepolia blockchain! 🌐 Averix is your smart sidekick, capable of autonomously executing 10+ blockchain actions with finesse. 🚀

- 🔑 Set up and manage your wallet effortlessly  
- 💰 Check your ETH and token balances (e.g., MTK) in a snap  
- 📤 Send ETH or custom tokens to any address  
- ✍️ Sign messages with top-notch security  
- 📜 Peek into your recent transaction history  
- ⛽ Fetch live gas price estimates  
- 💹 Get real-time token prices (powered by CoinGecko)  
- 🔥 Explore trending tokens on Arbitrum Sepolia  
- 🪙 Launch your own tokens (e.g., MyToken MTK) on the testnet  
- 💧 Grab testnet ETH from the Arbitrum faucet  
- And more awesomeness awaits... ✨  

Built for everyone—from AI wizards in San Francisco to crypto hustlers worldwide—**Averix** brings the Arbitrum ecosystem to your fingertips. 🌍 No matter your background, this agent makes blockchain exploration simple, smart, and fun! 💡

## Try Averix Now! 🌟  
Check out the agent in action on our website:  
👉 **[Averix AI](https://averix-ai.vercel.app/)**

## 🔧 Core Blockchain Features

- **Wallet & Token Operations**
  - 🔑 Set up and manage wallets on Arbitrum Sepolia
  - 💰 Check your ETH and token balances (e.g., MTK) instantly
  - 📤 Transfer ETH or custom tokens (e.g., batch transfer MTK)
  - 🪙 Create and deploy your own ERC-20 tokens on Arbitrum Sepolia
  - 💧 Request testnet ETH from the Arbitrum faucet
  - ✍️ Sign messages securely with your wallet

- **Blockchain Insights**
  - 📜 Fetch recent transaction history with Arbiscan links
  - ⛽ Get real-time gas price estimates
  - 💹 Retrieve live token prices via CoinGecko
  - 🔥 Discover trending tokens on Arbitrum Sepolia

## 🤖 AI Integration Features

- **LangChain Integration**
  - 🛠️ Built-in LangChain tools for seamless blockchain operations
  - ⚛️ Autonomous agent support with React framework
  - 🧠 Persistent memory for smooth, context-aware interactions
  - 📡 Streaming responses for real-time feedback

- **Vercel Deployment**
  - 🌐 Hosted on Vercel for fast and reliable access
  - 🧩 Framework-agnostic design with easy frontend integration
  - ⚡ Quick setup with environment variable support

- **Agent Modes**
  - 💬 Interactive chat mode for guided blockchain operations
  - 🤖 Autonomous mode for independent task execution
  - 🛡️ Built-in error handling for robust performance

- **AI-Powered Tools**
  - 📝 Natural language processing for intuitive blockchain commands
  - 💹 Price feed integration for token market insights
  - ⚙️ Automated decision-making to simplify complex actions

## 📦 Installation

Setting up Averix | Arbitrum AI Agent locally is super simple. Follow these steps:

```bash
# Clone the repository
git clone https://github.com/nikhilraikwar-aelix/averix.git
cd averix

# Install dependencies
npm install
```

## Quick Start

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, END } from "@langchain/langgraph";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
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
import cors from 'cors';

dotenv.config();

// Environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || "";
const ARBITRUM_RPC_URL = process.env.ARBITRUM_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
const ARBITRUM_EXPLORER_URL = "https://sepolia.arbiscan.io";
const ARBITRUM_FAUCET_URL = "https://faucet.triangleplatform.com/arbitrum/sepolia";

// Logger setup
const log = new Logger({ name: "ArbitrumAgent" });
```

```bash
# 🛠 Backend Setup

### Step 1: Navigate to the Backend Directory
Run the following command to move into the backend directory:
```bash
cd arbitrum-agent

### Step 2: Install Backend Dependencies
Use the following command to install all necessary dependencies:
npm install

### Step 3: Set up environment variables (create a .env file in arbitrum-agent/):
OPENAI_API_KEY=your-openai-api-key
COINGECKO_API_KEY=your-coingecko-api-key
ARBITRUM_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc

### Step 4: Run the backend:
npx ts-node arbitrum-agent-backend.ts

### Step 5: Test Backend using curl command:
curl -X POST http://localhost:3000/agent -H "Content-Type: application/json" -d '{"input": "help"}'
```

```bash
# 🌐 Frontend Setup

### Step 1: Return to the Root Directory
cd ..
### Step 2: Install frontend dependencies
npm install
### Step 3: Set up environment variables (create a .env file in root)
VITE_API_ENDPOINT=http://localhost:3000/agent  
VITE_METAMASK_ENABLED=true
### Step 4: Run the frontend
npm run dev

- Open http://localhost:5173/dashboard in your browser and connect your wallet via MetaMask.
- 🎉 Your Averix AI Agent is now up and running! 🚀
```

## Usage Examples

Averix | Arbitrum AI Agent accepts commands through its chat interface (`src/components/ChatInterface.tsx`). Here are the operations with examples:

### Set Wallet
Set your Arbitrum Sepolia wallet:
- **Command**: `setWallet <your-private-key>`
- **Response**: `Wallet set to address: 0xYourWalletAddress`

### Check Balance
Check your wallet's ETH and token balances:
- **Command**: `getBalance`
- **Response**: `ETH Balance: 0.5 ETH\nMTK Balance: 1000 MTK`

### Transfer Tokens
Send ETH or tokens to any address:
- **Command**: `batchMixedTransfer TOKEN 0xa1196778c1ADF48689D72E4B370518dbb2E9c01F 5 MTK`
- **Response**: `Successfully transferred 5 MTK to 0xa1196778c1ADF48689D72E4B370518dbb2E9c01F. Transaction hash: 0x...`

### Get Token Price
Fetch real-time token price (via CoinGecko):
- **Command**: `getTokenPrice ETH`
- **Response**: `ETH price: $2500 USD`

### Create Token
Create a new ERC-20 token on Arbitrum Sepolia:
- **Command**: `createToken MyToken MTK 1000`
- **Response**: `Token MyToken (MTK) created with 1000 supply. Token address: 0x...`

### Get Faucet Tokens
Get testnet ETH:
- **Command**: `getFaucetTokens 0xYourWalletAddress`
- **Response**: `Visit https://faucet.triangleplatform.com/arbitrum/sepolia to claim testnet ETH for 0xYourWalletAddress`

## Dependencies

We’ve used these key libraries:

### Backend (`arbitrum-agent/`)
- `@langchain/openai` - For AI model integration
- `ethers` - For Arbitrum Sepolia blockchain interactions
- `express` - For the API server
- `axios` - For HTTP requests (e.g., CoinGecko)
- `cors` - For cross-origin requests

### Frontend (`src/`)
- `react` - UI framework
- `@metamask/providers` - Wallet authentication
- `@tanstack/react-query` - Data fetching
- `shadcn/ui` - UI components
- `tailwindcss` - Styling

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License 📝

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Security

Handle private keys with care and never share them. Store sensitive data in `.env` files and add them to `.gitignore`.
