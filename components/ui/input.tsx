import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'outline';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', variant = 'default', ...props }, ref) => {
    const baseStyles =
      'px-3 py-2 border rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500';
    
    const variantStyles =
      variant === 'outline'
        ? 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white'
        : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white';

    return (
      <input
        ref={ref}
        className={`${baseStyles} ${variantStyles} ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
