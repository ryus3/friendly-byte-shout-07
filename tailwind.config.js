/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
        tajawal: ['Tajawal', 'sans-serif'],
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
        // Order Status Colors - Beautiful gradients
        'status-pending': {
          'start': "hsl(var(--status-pending-start))",
          'end': "hsl(var(--status-pending-end))",
          'border': "hsl(var(--status-pending-border))",
          'shadow': "hsl(var(--status-pending-shadow))",
        },
        'status-shipped': {
          'start': "hsl(var(--status-shipped-start))",
          'end': "hsl(var(--status-shipped-end))",
          'border': "hsl(var(--status-shipped-border))",
          'shadow': "hsl(var(--status-shipped-shadow))",
        },
        'status-delivery': {
          'start': "hsl(var(--status-delivery-start))",
          'end': "hsl(var(--status-delivery-end))",
          'border': "hsl(var(--status-delivery-border))",
          'shadow': "hsl(var(--status-delivery-shadow))",
        },
        'status-delivered': {
          'start': "hsl(var(--status-delivered-start))",
          'end': "hsl(var(--status-delivered-end))",
          'border': "hsl(var(--status-delivered-border))",
          'shadow': "hsl(var(--status-delivered-shadow))",
        },
        'status-completed': {
          'start': "hsl(var(--status-completed-start))",
          'end': "hsl(var(--status-completed-end))",
          'border': "hsl(var(--status-completed-border))",
          'shadow': "hsl(var(--status-completed-shadow))",
        },
        'status-returned': {
          'start': "hsl(var(--status-returned-start))",
          'end': "hsl(var(--status-returned-end))",
          'border': "hsl(var(--status-returned-border))",
          'shadow': "hsl(var(--status-returned-shadow))",
        },
        'status-returned-stock': {
          'start': "hsl(var(--status-returned-stock-start))",
          'end': "hsl(var(--status-returned-stock-end))",
          'border': "hsl(var(--status-returned-stock-border))",
          'shadow': "hsl(var(--status-returned-stock-shadow))",
        },
        'status-cancelled': {
          'start': "hsl(var(--status-cancelled-start))",
          'end': "hsl(var(--status-cancelled-end))",
          'border': "hsl(var(--status-cancelled-border))",
          'shadow': "hsl(var(--status-cancelled-shadow))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0", opacity: "0" },
          to: { height: "var(--radix-accordion-content-height)", opacity: "1" }
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)", opacity: "1" },
          to: { height: "0", opacity: "0" }
        },
        "fade-in": {
          "0%": {
            opacity: "0",
            transform: "translateY(10px)"
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)"
          }
        },
        "fade-out": {
          "0%": {
            opacity: "1",
            transform: "translateY(0)"
          },
          "100%": {
            opacity: "0",
            transform: "translateY(10px)"
          }
        },
        "scale-in": {
          "0%": {
            transform: "scale(0.95)",
            opacity: "0"
          },
          "100%": {
            transform: "scale(1)",
            opacity: "1"
          }
        },
        "scale-out": {
          from: { transform: "scale(1)", opacity: "1" },
          to: { transform: "scale(0.95)", opacity: "0" }
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" }
        },
        "slide-out-right": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(100%)" }
        },
        "pulse-slow": {
          '50%': { opacity: .5 },
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "fade-out": "fade-out 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "scale-out": "scale-out 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "slide-out-right": "slide-out-right 0.3s ease-out",
        "enter": "fade-in 0.3s ease-out, scale-in 0.2s ease-out",
        "exit": "fade-out 0.3s ease-out, scale-out 0.2s ease-out",
        "pulse-slow": "pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    function({ addUtilities }) {
      const newUtilities = {
        '.story-link': {
          position: 'relative',
          display: 'inline-block',
          '&::after': {
            content: "''",
            position: 'absolute',
            width: '100%',
            transform: 'scaleX(0)',
            height: '2px',
            bottom: '0',
            left: '0',
            backgroundColor: 'hsl(var(--primary))',
            transformOrigin: 'bottom right',
            transition: 'transform 0.3s ease-out',
          },
          '&:hover::after': {
            transform: 'scaleX(1)',
            transformOrigin: 'bottom left',
          },
        },
        '.hover-scale': {
          transition: 'transform 0.2s ease-out',
          '&:hover': {
            transform: 'scale(1.05)',
          },
        },
        '.pulse': {
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        },
      }
      addUtilities(newUtilities)
    }
  ],
}