/** @type {import('tailwindcss').Config} */
export default {
  content: ["./popup.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Source Sans 3", "sans-serif"],
        serif: ["Fraunces", "Georgia", "serif"],
      },
      colors: {
        surface: {
          DEFAULT: "#100e0c",
          elevated: "#1a1714",
          paper: "#221f1b",
          border: "#342f2a",
        },
        ink: {
          DEFAULT: "#e9e5df",
          muted: "#a39a90",
          faint: "#6b6560",
        },
        accent: {
          safe: "#8fb89a",
          warn: "#d4a574",
          danger: "#c97d72",
          line: "#4a6b7c",
        },
      },
      letterSpacing: {
        editorial: "0.22em",
      },
    },
  },
  plugins: [],
};
