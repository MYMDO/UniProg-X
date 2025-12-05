/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Semantic Dashboard Colors
                dashboard: {
                    dark: '#0f172a',    // Main Background Dark
                    light: '#f8fafc',   // Main Background Light
                    panel: {
                        dark: '#1e293b',
                        light: '#ffffff'
                    },
                    border: {
                        dark: 'rgba(255,255,255,0.1)',
                        light: 'rgba(0,0,0,0.1)'
                    }
                }
            },
            plugins: [],
        }
    }
}
