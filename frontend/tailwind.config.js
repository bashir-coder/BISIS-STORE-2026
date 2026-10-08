/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Unified card system (Phase 3). Always shipped so the whole family
  // survives purge even before every variant has a call site.
  safelist: [
    "card",
    "card-default",
    "card-featured",
    "card-interactive",
    "card-pricing",
    "card-pricing-focal",
    "card-status",
    "card-status-success",
    "card-status-info",
    "card-is-active",
    "card-accent-bar",
    "card-eyebrow",
    "card-title",
    "card-body",
    "card-meta",
    "card-pad",
    "card-pad-lg",
  ],
  theme: {
    extend: {
      zIndex: {
        '-10': '-10',
        '-20': '-20',
        '-50': '-50',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        gold: {
          DEFAULT: "#D4AF37",
          light: "#F0C94A",
          bright: "#FFE58A",
          deep: "#9F7A18",
          text: "#F0C94A",
        },
        blue: {
          DEFAULT: "#2F7BFF",
          light: "#60A5FA",
          bright: "#93C5FD",
          deep: "#1D5FD8",
          text: "#60A5FA",
        },
        dark: {
          DEFAULT: "#020304",
          lighter: "#05070A",
          panel: "#090C10",
          panel2: "#0D1217",
          card: "#12171E",
        },
      },
      boxShadow: {
        'gold-neon': '0 0 14px rgba(212, 175, 55, 0.35), 0 0 28px rgba(212, 175, 55, 0.15)',
        'blue-neon': '0 0 14px rgba(47, 123, 255, 0.35), 0 0 28px rgba(47, 123, 255, 0.15)',
        'glass': 'inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 18px 48px rgba(0, 0, 0, 0.35)',
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        cairo: ['Cairo', 'sans-serif'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(212, 175, 55, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(212, 175, 55, 0.6)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 2s linear infinite",
        float: "float 3s ease-in-out infinite",
        glow: "glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}