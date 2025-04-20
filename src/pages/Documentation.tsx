import React from 'react';
import MainLayout from '../layouts/MainLayout';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const Documentation: React.FC = () => {
  // Array of documentation sections
  const sections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      content: [
        {
          subtitle: 'What is Averix?',
          text: 'Averix is an advanced AI agent built for Arbitrum Sepolia (Chain ID: 421614). Using cutting-edge AI, Averix simplifies blockchain interactions through natural language, enabling easy token creation (e.g., MyToken MTK), wallet management, and transaction handling for beginners and experts alike.'
        },
        {
          subtitle: 'Connecting Your Wallet',
          text: 'To start using Averix, click the "Get Started" button on the homepage. Connect your MetaMask wallet configured for Arbitrum Sepolia. Once connected, you’ll be redirected to the dashboard to interact with the AI agent.'
        }
      ]
    },
    {
      id: 'commands',
      title: 'Basic Commands',
      content: [
        {
          subtitle: 'Wallet Management',
          text: 'Set your wallet with "setWallet [PRIVATE_KEY]". Check your ETH and token balances (e.g., MTK) with "getBalance". View your wallet address with "getWalletAddress". Disconnect your wallet with "disconnectWallet".'
        },
        {
          subtitle: 'Token Creation',
          text: 'Create a new ERC-20 token with "createToken [NAME] [SYMBOL] [SUPPLY]". For example: "createToken MyToken MTK 1000" creates 1000 MTK tokens.'
        },
        {
          subtitle: 'Transactions',
          text: 'Transfer ETH or tokens with "batchMixedTransfer [TYPE] [TO] [AMOUNT] [TOKEN_NAME]". For example: "batchMixedTransfer TOKEN 0xa1196778c1ADF48689D72E4B370518dbb2E9c01F 5 MTK" sends 5 MTK. Transfer ETH with "transferTokens [TO] [AMOUNT]". Sign a message with "signMessage [MESSAGE]".'
        }
      ]
    },
    {
      id: 'advanced',
      title: 'Advanced Features',
      content: [
        {
          subtitle: 'Token Analytics',
          text: 'Get real-time token prices with "getTokenPrice [TOKEN]". For example: "getTokenPrice ETH". View trending tokens with "getTrendingTokens".'
        },
        {
          subtitle: 'Gas Optimization',
          text: 'Check current gas prices with "getGasPrice" to optimize transaction costs.'
        },
        {
          subtitle: 'Transaction History',
          text: 'View recent transactions with "getTransactionHistory [COUNT]". For example: "getTransactionHistory 5" shows the last 5 transactions with Arbiscan links.'
        }
      ]
    },
    {
      id: 'resources',
      title: 'Additional Resources',
      content: [
        {
          subtitle: 'Arbitrum Faucet',
          text: 'Get testnet ETH with "getFaucetTokens [ADDRESS]". The agent provides instructions to claim tokens from https://faucet.triangleplatform.com/arbitrum/sepolia.'
        },
        {
          subtitle: 'Help & Support',
          text: 'Type "help" to see all available commands. For assistance, reach out via the support link on the dashboard.'
        }
      ]
    }
  ];

  return (
    <MainLayout>
      <div className="section-padding">
        <div className="max-w-4xl mx-auto">
          <div className="mb-10">
            <h1 className="text-4xl font-bold mb-4">Documentation</h1>
            <p className="text-xl text-muted-foreground">
              Learn how to interact with the Averix AI agent on Arbitrum Sepolia
            </p>
          </div>

          <div className="flex flex-col space-y-10">
            {sections.map((section, index) => (
              <div key={section.id} id={section.id} className="scroll-mt-24">
                <RevealItem delay={index * 100}>
                  <h2 className="text-2xl font-semibold mb-6">{section.title}</h2>
                  
                  <div className="grid gap-6">
                    {section.content.map((item, i) => (
                      <div key={i} className="glass-effect p-6 rounded-xl">
                        <h3 className="text-lg font-medium mb-2">{item.subtitle}</h3>
                        <p className="text-muted-foreground">{item.text}</p>
                      </div>
                    ))}
                  </div>
                  
                  {index < sections.length - 1 && (
                    <Separator className="mt-10" />
                  )}
                </RevealItem>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

// Simple reveal animation component for documentation sections
const RevealItem: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className }) => {
  return (
    <div
      className={cn(
        "opacity-0 animate-fade-in",
        className
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      {children}
    </div>
  );
};

export default Documentation;