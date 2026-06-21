/** @type {import('tailwindcss').Config} */
export default {
  content: ["./popup.html", "./stats.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Source Sans 3", "sans-serif"],
        serif: ["Fraunces", "Georgia", "serif"],
      },
      colors: {
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          elevated: "rgb(var(--surface-elevated) / <alpha-value>)",
          paper: "rgb(var(--surface-paper) / <alpha-value>)",
          border: "rgb(var(--surface-border) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
          faint: "rgb(var(--ink-faint) / <alpha-value>)",
        },
        accent: {
          safe: "rgb(var(--accent-safe) / <alpha-value>)",
          warn: "rgb(var(--accent-warn) / <alpha-value>)",
          danger: "rgb(var(--accent-danger) / <alpha-value>)",
          line: "rgb(var(--accent-line) / <alpha-value>)",
        },
      },
      letterSpacing: {
        editorial: "0.22em",
      },
    },
  },
  plugins: [],
};
