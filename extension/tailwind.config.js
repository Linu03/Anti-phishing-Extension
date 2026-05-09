/** @type {import('tailwindcss').Config} */
export default {
  content: ["./popup.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Outfit", "system-ui", "sans-serif"],
      },
      colors: {
        surface: {
          DEFAULT: "#0f1419",
          elevated: "#161d27",
          border: "#243044",
        },
        accent: {
          safe: "#34d399",
          warn: "#fbbf24",
          danger: "#f87171",
          info: "#38bdf8",
        },
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(56, 189, 248, 0.35)",
      },
    },
  },
  plugins: [],
};
