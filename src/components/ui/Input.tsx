import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', label, error, icon, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {icon && (
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
                            {icon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={`
              w-full py-4 px-5 text-base
              bg-[var(--bg-secondary)] 
              border border-[var(--card-border)] 
              rounded-xl
              text-[var(--text-primary)]
              placeholder:text-[var(--text-tertiary)]
              transition-all duration-200
              focus:outline-none focus:border-[var(--color-accent)] focus:shadow-[0_0_0_4px_rgba(0,113,227,0.2)]
              ${icon ? 'pl-12' : ''}
              ${error ? 'border-[var(--color-error)]' : ''}
              ${className}
            `}
                        {...props}
                    />
                </div>
                {error && (
                    <p className="mt-2 text-sm text-[var(--color-error)]">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
