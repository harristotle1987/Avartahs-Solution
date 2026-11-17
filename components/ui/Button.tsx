import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

export interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: 'primary' | 'outline' | 'glow' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  isLoading = false,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58A52]';
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-xs sm:text-sm gap-2',
    lg: 'px-6 py-3 text-sm sm:text-base gap-2.5',
  };

  const variantStyles = {
    primary: 'bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] shadow-sm hover:shadow transition-all duration-300 hover:-translate-y-0.5',
    outline: 'bg-white dark:bg-[#171A1D] border border-slate-200 dark:border-[#30363B] text-slate-800 dark:text-[#F2F1ED] hover:border-[#C58A52]/60 dark:hover:border-[#C58A52]/60 transition-all duration-300 hover:-translate-y-0.5',
    glow: 'bg-[#C58A52] text-[#111315] shadow-lg shadow-[#C58A52]/20 hover:shadow-xl hover:shadow-[#C58A52]/30 transition-all duration-300 hover:-translate-y-0.5',
    secondary: 'bg-slate-100 dark:bg-[#202428] text-slate-900 dark:text-[#F2F1ED] hover:bg-slate-200 dark:hover:bg-[#282C32] transition-all duration-300 hover:-translate-y-0.5',
    ghost: 'text-slate-700 dark:text-[#A3A9AF] hover:text-slate-900 dark:hover:text-[#F2F1ED] hover:bg-slate-100 dark:hover:bg-[#202428] transition-all duration-300',
  };

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1 }}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Processing...
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
};
