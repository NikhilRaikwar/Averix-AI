import React from 'react';
import RevealOnScroll from './ui/RevealOnScroll';
import { CheckIcon, Clock, Calendar, Globe } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface RoadmapPhase {
  status: 'completed' | 'in-progress' | 'upcoming' | 'future';
  phase: string;
  title: string;
  description: string;
  items: Array<{
    text: string;
    completed: boolean;
  }>;
  icon: LucideIcon;
}

const RoadmapItem: React.FC<{ phase: RoadmapPhase; index: number }> = ({ phase, index }) => {
  const Icon = phase.icon;
  
  return (
    <RevealOnScroll delay={index * 100}>
      <div className="relative pl-8 pb-12 border-l border-primary/20 last:border-0 ml-4">
        <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center transform -translate-x-1/2">
          <Icon size={16} className="text-primary" />
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={cn(
            "inline-block px-3 py-1 text-xs font-medium rounded-full",
            phase.status === 'completed' ? "bg-green-500/10 text-green-500" :
            phase.status === 'in-progress' ? "bg-amber-500/10 text-amber-500" :
            phase.status === 'upcoming' ? "bg-blue-500/10 text-blue-500" :
            "bg-purple-500/10 text-purple-500"
          )}>
            {phase.phase}
          </span>
          {phase.status === 'completed' && 
            <span className="inline-block px-3 py-1 text-xs font-medium bg-green-500/10 text-green-500 rounded-full">
              Completed
            </span>
          }
          {phase.status === 'in-progress' && 
            <span className="inline-block px-3 py-1 text-xs font-medium bg-amber-500/10 text-amber-500 rounded-full">
              In Progress
            </span>
          }
        </div>
        <h3 className="text-xl font-semibold mb-2">{phase.title}</h3>
        <p className="text-muted-foreground mb-4">{phase.description}</p>
        
        <ul className="space-y-2">
          {phase.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              {item.completed ? (
                <CheckIcon size={16} className="text-green-500 mt-1 shrink-0" />
              ) : (
                <div className="w-4 h-4 border border-muted-foreground/40 rounded mt-0.5 shrink-0" />
              )}
              <span className={cn(
                "text-sm",
                item.completed ? "text-foreground" : "text-muted-foreground"
              )}>
                {item.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </RevealOnScroll>
  );
};

// Helper function for className conditional joining
const cn = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(' ');
};

const Roadmap: React.FC = () => {
  const roadmapPhases: RoadmapPhase[] = [
    {
      status: 'completed',
      phase: "Phase 1",
      title: "Testnet Launch & Core Features",
      description: "Averix successfully launched on Arbitrum Sepolia (Chain ID: 421614) with core AI functionality.",
      icon: CheckIcon,
      items: [
        { text: "Wallet & Transactions: setWallet, getWalletAddress, getBalance, transferTokens, signMessage, getTransactionHistory", completed: true },
        { text: "Gas & Token Tools: getGasPrice, getTokenPrice, getTrendingTokens, createToken, getFaucetTokens, batchMixedTransfer", completed: true },
        { text: "Faucet Integration: Testnet ETH claimable via faucet.triangleplatform.com/arbitrum/sepolia", completed: true },
        { text: "Public Beta Testing: Core AI tools fully functional & tested", completed: true }
      ]
    },
    {
      status: 'in-progress',
      phase: "Phase 2",
      title: "Advanced Token Features & AI Enhancements",
      description: "Expanding Averix's AI capabilities to include batch transfers, governance, and a richer agent ecosystem.",
      icon: Clock,
      items: [
        { text: "AI-Driven Governance: Deploy createGovernance for community-based decision-making", completed: false },
        { text: "AI Proposal Engine: Suggest governance proposals based on user activity & transaction trends", completed: false },
        { text: "Batch Transfer Optimization: Enhance batchMixedTransfer for multi-token operations", completed: true },
        { text: "Token Price Fetching: Integrated CoinGecko for real-time ETH price updates", completed: true },
        { text: "Multi-Token Support: Extend batchMixedTransfer & getBalance to support custom Averix ERC-20 tokens", completed: true },
        { text: "AI-Powered Market Insights: Predict token trends & portfolio optimization strategies", completed: false },
        { text: "UI Development: Intuitive dashboard for wallet management, token creation, and AI insights", completed: false },
        { text: "Agent Ecosystem: Introduce trading agents and governance agents", completed: false },
        { text: "Social Agents for X: AI bots to analyze X sentiment, promote Averix, and engage users", completed: false },
        { text: "Agent Wallet Creation: Enable AI agents to autonomously manage wallets and execute transactions", completed: false },
        { text: "Dynamic Fee Adjustment: AI adjusts gas fees dynamically for cost-efficient transactions", completed: false },
        { text: "Personalized AI Recommendations: Tailored token management strategies per user", completed: false }
      ]
    },
    {
      status: 'upcoming',
      phase: "Phase 3",
      title: "Mainnet Integration",
      description: "Full integration with Arbitrum One mainnet, offering production-ready AI tools for blockchain operations.",
      icon: Calendar,
      items: [
        { text: "Risk Model v1: AI-driven risk assessment for transactions (gas fees vs. token value)", completed: false },
        { text: "Mainnet Migration: Upgrade all AI tools for production-ready blockchain operations", completed: false }
      ]
    },
    {
      status: 'future',
      phase: "Phase 4",
      title: "Ecosystem Expansion",
      description: "Partnerships with key DeFi protocols and development of custom AI agents tailored to Arbitrum.",
      icon: Globe,
      items: [
        { text: "Advanced Token Interactions: AI-automated token swaps & liquidity provision", completed: false },
        { text: "Ecosystem Partnerships: Integrate Averix with Arbitrum-native DeFi platforms (DEXes, lending protocols)", completed: false },
        { text: "Custom AI Agents: Specialized AI-driven bots for trading, lending, and governance", completed: false }
      ]
    }
  ];

  return (
    <section id="roadmap" className="section-padding">
      <div className="max-w-7xl mx-auto">
        <RevealOnScroll>
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 text-xs font-medium text-primary bg-primary/10 rounded-full mb-4">
              Roadmap
            </span>
            <h2 className="text-balance mb-4">🚀 Our Journey Forward</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              The evolution of Averix on the Arbitrum blockchain, from concept to ecosystem.
            </p>
          </div>
        </RevealOnScroll>

        <div className="max-w-3xl mx-auto">
          {roadmapPhases.map((phase, index) => (
            <RoadmapItem key={phase.phase} phase={phase} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Roadmap;