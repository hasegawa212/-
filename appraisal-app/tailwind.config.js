/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // 主色：深いインク（濃紺〜墨）。ボタン・ヘッダー・見出しに使用
        brand: {
          50: "#f5f6f8",
          100: "#e7eaef",
          200: "#c8cfdb",
          300: "#9aa6ba",
          400: "#5f6f8a",
          500: "#34425c",
          600: "#1f2a40",
          700: "#161e30",
          800: "#0f1626",
          900: "#0a0f1b",
        },
        // 差し色：シャンパンゴールド。アクセント・罫線・ハイライトに使用
        gold: {
          50: "#fbf7ec",
          100: "#f3e9cc",
          200: "#e6d29a",
          300: "#d8bd74",
          400: "#c9a74e",
          500: "#b6892f",
          600: "#9a6f24",
        },
        ink: "#0b0f1a",
        cream: "#faf8f3",
      },
      fontFamily: {
        sans: [
          "Zen Kaku Gothic New",
          "Inter",
          "Hiragino Kaku Gothic ProN",
          "Noto Sans JP",
          "sans-serif",
        ],
        // 見出し・金額用の明朝体（和の高級感）
        display: [
          "Shippori Mincho",
          "Cormorant Garamond",
          "Hiragino Mincho ProN",
          "Yu Mincho",
          "serif",
        ],
      },
      boxShadow: {
        luxe: "0 20px 50px -24px rgba(15, 22, 38, 0.45)",
        card: "0 1px 2px rgba(15,22,38,0.04), 0 8px 24px -16px rgba(15,22,38,0.25)",
      },
      letterSpacing: {
        widest2: "0.22em",
      },
    },
  },
  plugins: [],
};
