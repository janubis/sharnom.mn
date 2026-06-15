import type { Config } from "tailwindcss";

/**
 * Mongol Local design system.
 *
 * Palette is driven by CSS custom properties declared in `src/app/globals.css`
 * (HSL channel values) so we can theme light/dark and stay shadcn-compatible.
 *
 * Brand language:
 *   - khadag  : хадаг хөх — sky/azure blue (primary, trust)
 *   - gobi    : Gobi sand / warm gold (secondary, warmth)
 *   - cream   : warm off-white background
 *   - charcoal: deep warm charcoal text
 *   - soyombo : Mongolian red accent (used sparingly)
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" },
      screens: { "2xl": "1320px" },
    },
    extend: {
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
        // Semantic brand aliases (also exposed as utility colors)
        khadag: {
          DEFAULT: "hsl(var(--khadag))",
          foreground: "hsl(var(--primary-foreground))",
        },
        gobi: {
          DEFAULT: "hsl(var(--gobi))",
          foreground: "hsl(var(--gobi-foreground))",
        },
        soyombo: "hsl(var(--soyombo))",
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(28, 25, 23, 0.04), 0 4px 16px rgba(28, 25, 23, 0.06)",
        "card-hover": "0 2px 4px rgba(28, 25, 23, 0.06), 0 12px 32px rgba(28, 25, 23, 0.10)",
        float: "0 8px 40px rgba(28, 25, 23, 0.14)",
      },
      backgroundImage: {
        // Subtle Mongolian motif overlays (SVG in /public/patterns)
        "ulzii": "url('/patterns/ulzii.svg')",
        "uulen": "url('/patterns/uulen.svg')",
        "khadag-gradient":
          "linear-gradient(135deg, hsl(var(--khadag)) 0%, hsl(210 88% 38%) 100%)",
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
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.25s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
