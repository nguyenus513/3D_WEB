import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'bento' | 'product';
    hover?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
    ({ className = '', variant = 'default', hover = true, children, ...props }, ref) => {
        const variants = {
            default: 'bg-[var(--card-bg)] rounded-2xl p-6 border border-[var(--card-border)]',
            bento: 'bg-[var(--card-bg)] rounded-3xl overflow-hidden border border-[var(--card-border)]',
            product: 'bg-[var(--card-bg)] rounded-2xl overflow-hidden border border-[var(--card-border)] cursor-pointer',
        };

        const hoverEffects = {
            default: 'hover:scale-[1.02]',
            bento: 'hover:scale-[1.01]',
            product: 'hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)]',
        };

        return (
            <div
                ref={ref}
                className={`
          ${variants[variant]}
          transition-all duration-300
          ${hover ? hoverEffects[variant] : ''}
          ${className}
        `}
                {...props}
            >
                {children}
            </div>
        );
    }
);

Card.displayName = 'Card';
