import type { Config } from 'tailwindcss'

const config: Config = {
    content: [
        './src/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-be-vietnam-pro)', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
}

export default config
