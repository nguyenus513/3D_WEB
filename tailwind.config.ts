import type { Config } from 'tailwindcss'

const config: Config = {
    content: [
        './src/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['General Sans', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
}

export default config
