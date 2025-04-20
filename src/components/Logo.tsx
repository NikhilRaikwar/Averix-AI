
import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className }) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img 
        src="/images/averix.png" 
        alt="Averix Logo" 
        className="h-16 sm:h-20 md:h-24 w-auto" 
      />
    </div>
  );
};

export default Logo;
