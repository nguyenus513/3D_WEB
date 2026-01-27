import type { Config } from 'tailwindcss'

const config: Config = {
    content: {
        files: [
            './src/**/*.{js,ts,jsx,tsx,mdx}',
        ],
    },
    theme: {
        extend: {},
    },
    plugins: [],
    // Blocklist invalid utilities that cause CSS parsing errors
    blocklist: [
        '[-:|]',
        '[-:]',
        '[:|]',
    ],
}

export default config
