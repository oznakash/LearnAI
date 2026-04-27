/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b1020",
        ink2: "#121833",
        accent: "#7c5cff",
        accent2: "#28e0b3",
        warn: "#ffb547",
        bad: "#ff5d8f",
        good: "#28e0b3",
        soft: "#1b2348",
      },
      fontFamily: {
        display: ['"Space Grotesk"', "ui-sans-serif", "system-ui"],
        sans: ['"Inter"', "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        glow: "0 0 0 4px rgba(124,92,255,0.18)",
        card: "0 10px 30px -10px rgba(15,23,42,0.5)",
      },
      animation: {
        pop: "pop 220ms ease-out",
        float: "float 4s ease-in-out infinite",
        wiggle: "wiggle 400ms ease-in-out",
      },
      keyframes: {
        pop: { "0%": { transform: "scale(.92)" }, "100%": { transform: "scale(1)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        wiggle: { "0%,100%": { transform: "rotate(0)" }, "25%": { transform: "rotate(-3deg)" }, "75%": { transform: "rotate(3deg)" } },
      },
    },
  },
  plugins: [],
};
