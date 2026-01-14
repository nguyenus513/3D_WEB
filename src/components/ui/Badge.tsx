interface BadgeProps {
    variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
    children: React.ReactNode;
    className?: string;
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
    const variants = {
        default: 'bg-[var(--bg-secondary)] text-[var(--text-primary)]',
        success: 'bg-[rgba(48,209,88,0.15)] text-[var(--color-success)]',
        warning: 'bg-[rgba(255,214,10,0.15)] text-[var(--color-warning)]',
        error: 'bg-[rgba(255,69,58,0.15)] text-[var(--color-error)]',
        info: 'bg-[rgba(0,113,227,0.15)] text-[var(--color-accent)]',
    };

    return (
        <span
            className={`
        inline-flex items-center gap-1.5 
        px-3 py-1 
        text-xs font-medium 
        rounded-full
        ${variants[variant]}
        ${className}
      `}
        >
            {children}
        </span>
    );
}
