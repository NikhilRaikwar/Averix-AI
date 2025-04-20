
import React, { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import Logo from './Logo';

const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const { login, authenticated, logout } = usePrivy();
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboard = location.pathname === '/dashboard';

  useEffect(() => {
    const handleScroll = () => {
      // Only detect if page is scrolled for shadow effect
      setIsScrolled(window.scrollY > 20);
    };
    
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleConnectWallet = async () => {
    if (authenticated) {
      navigate('/dashboard');
    } else {
      login();
    }
  };

  return (
    <header 
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-elastic",
        isScrolled 
          ? "bg-background/95 backdrop-blur-lg shadow-sm" 
          : "bg-background/90 backdrop-blur-md",
        "border-b border-border/40 py-2"
      )}
    >
      <div className="container mx-auto px-4 flex items-center justify-between">
        <a href="/" className="transition-all duration-300">
          <Logo />
        </a>
        
        <div className="flex items-center">
          <button 
            onClick={isDashboard ? () => logout() : handleConnectWallet}
            className={cn(
              "px-4 py-2 rounded-lg transition-all duration-300",
              "text-base",
              isDashboard
                ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {isDashboard ? "Disconnect" : (authenticated ? "Dashboard" : "Connect Wallet")}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
