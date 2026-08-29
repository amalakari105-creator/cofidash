/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Échantillonné sur coficab.com — bleu marine profond de la nav + bleu
        // périwinkle de l'overlay hero.
        navy: {
          950: "#04072E",
          900: "#000168",
          800: "#0B1B7A",
          700: "#1F2F94",
          600: "#35479D",
          500: "#4C63AA",
          400: "#7186C2",
          300: "#9AAAD6",
          200: "#C7D0EA",
          100: "#EDF0FA",
        },
        canvas: "#F6F7FB",
        alert: {
          red: "#C0392B",
          amber: "#C9822F",
          green: "#3E7A4A",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      borderRadius: {
        card: "10px",
      },
    },
  },
  plugins: [],
};
