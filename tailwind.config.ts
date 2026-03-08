import type { Config } from 'tailwindcss'

const config: Config = {
    darkMode: ['selector', '[data-theme="dark"]'],
    content: [
        './src/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-be-vietnam-pro)', 'system-ui', 'sans-serif'],
            },
            colors: {
                border: "var(--border-color)",
                input: "var(--input-bg)",
                ring: "var(--color-accent)",
                background: "var(--bg-void)",
                foreground: "var(--text-primary)",
                primary: {
                    DEFAULT: "var(--color-accent)",
                    foreground: "#FFFFFF",
                },
                secondary: {
                    DEFAULT: "var(--material-glass)",
                    foreground: "var(--text-primary)",
                },
                destructive: {
                    DEFAULT: "var(--color-error)",
                    foreground: "#FFFFFF",
                },
                muted: {
                    DEFAULT: "var(--material-glass)",
                    foreground: "var(--text-secondary)",
                },
                accent: {
                    DEFAULT: "var(--material-glass)",
                    foreground: "var(--text-primary)",
                },
                card: {
                    DEFAULT: "var(--material-panel)",
                    foreground: "var(--text-primary)",
                },
                popover: {
                    DEFAULT: "var(--material-overlay)",
                    foreground: "var(--text-primary)",
                },
            },
            borderRadius: {
                lg: "12px",
                md: "8px",
                sm: "6px",
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                breathe: {
                    '0%, 100%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(1.02)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
            },
            animation: {
                float: 'float 6s ease-in-out infinite',
                breathe: 'breathe 4s ease-in-out infinite',
                shimmer: 'shimmer 8s linear infinite',
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
}

export default config
