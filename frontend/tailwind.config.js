/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./views/**/*.ejs", "./src/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        brand: {
          gold: "#c9a96e",
          dark: "#111111",
          cream: "#f4f2ef",
        },
      },
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "serif"],
        sans: ["Poppins", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 12px 32px rgba(0,0,0,0.08)",
        soft: "0 10px 30px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};
