import { motion } from 'motion/react';
import { ReactNode } from 'react';

interface M3CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'elevated' | 'filled' | 'outlined';
  key?: any;
}

export function M3Card({ children, className = '', variant = 'filled' }: M3CardProps) {
  const variants = {
    elevated: 'bg-m3-surface shadow-sm hover:shadow-md border border-m3-outline-variant/30',
    filled: 'bg-m3-surface-container',
    outlined: 'bg-transparent border border-m3-outline-variant',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${variants[variant]} rounded-[24px] p-4 sm:p-6 transition-all duration-300 ${className}`}
    >
      {children}
    </motion.div>
  );
}
