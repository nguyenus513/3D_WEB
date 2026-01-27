/**
 * Design Tokens - 3D Print Studio
 * 
 * Centralized design system following ui-ux-pro-max and tailwind-patterns skills.
 * Uses semantic naming and OKLCH color format for perceptual uniformity.
 * 
 * @see ui-ux-pro-max/SKILL.md - Design System Guidelines
 * @see tailwind-patterns/SKILL.md - Color Token Architecture
 */

// =============================================================================
// Color Palette - Semantic Naming
// =============================================================================

export const colors = {
  // Primary - Electric Blue (Brand Color)
  primary: {
    50: 'oklch(0.97 0.02 250)',
    100: 'oklch(0.93 0.04 250)',
    200: 'oklch(0.86 0.08 250)',
    300: 'oklch(0.75 0.12 250)',
    400: 'oklch(0.65 0.16 250)',
    500: 'oklch(0.55 0.20 250)', // #0071E3 equivalent
    600: 'oklch(0.48 0.18 250)',
    700: 'oklch(0.40 0.15 250)',
    800: 'oklch(0.32 0.12 250)',
    900: 'oklch(0.25 0.10 250)',
  },
  
  // Accent - Purple Haze (Secondary)
  accent: {
    50: 'oklch(0.97 0.02 290)',
    100: 'oklch(0.93 0.04 290)',
    200: 'oklch(0.86 0.08 290)',
    300: 'oklch(0.75 0.12 290)',
    400: 'oklch(0.65 0.16 290)',
    500: 'oklch(0.55 0.18 290)', // Purple accent
    600: 'oklch(0.48 0.16 290)',
    700: 'oklch(0.40 0.14 290)',
    800: 'oklch(0.32 0.12 290)',
    900: 'oklch(0.25 0.10 290)',
  },

  // Neutral - Dark Theme Optimized
  neutral: {
    50: 'oklch(0.98 0 0)',   // Near white
    100: 'oklch(0.96 0 0)',
    200: 'oklch(0.92 0 0)',
    300: 'oklch(0.85 0 0)',
    400: 'oklch(0.70 0 0)',
    500: 'oklch(0.55 0 0)',
    600: 'oklch(0.40 0 0)',
    700: 'oklch(0.25 0 0)',
    800: 'oklch(0.15 0 0)',  // #1D1D1F equivalent
    900: 'oklch(0.08 0 0)',  // #0a0a0a - Primary background
    950: 'oklch(0.05 0 0)',  // Near black
  },

  // Status Colors
  success: 'oklch(0.72 0.19 145)',  // #30D158
  error: 'oklch(0.65 0.22 25)',     // #FF453A
  warning: 'oklch(0.88 0.18 95)',   // #FFD60A
  info: 'oklch(0.65 0.20 250)',     // Blue info
} as const;

// =============================================================================
// Typography System
// =============================================================================

export const typography = {
  // Font Families - Premium, not generic
  fontFamily: {
    sans: '"General Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    display: '"General Sans", "SF Pro Display", sans-serif',
    mono: '"JetBrains Mono", "Fira Code", monospace',
  },

  // Font Sizes - Apple Style Scale
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1.0625rem', { lineHeight: '1.47059' }],      // 17px
    lg: ['1.3125rem', { lineHeight: '1.381' }],          // 21px
    xl: ['1.5rem', { lineHeight: '1.3' }],               // 24px
    '2xl': ['1.75rem', { lineHeight: '1.2' }],           // 28px
    '3xl': ['2rem', { lineHeight: '1.15' }],             // 32px
    '4xl': ['2.5rem', { lineHeight: '1.1' }],            // 40px
    '5xl': ['3.5rem', { lineHeight: '1.05' }],           // 56px
    '6xl': ['5rem', { lineHeight: '1' }],                // 80px
    '7xl': ['7.5rem', { lineHeight: '0.95' }],           // 120px - Hero
  },

  // Font Weights
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Letter Spacing - Tight for headings
  letterSpacing: {
    tighter: '-0.04em',
    tight: '-0.02em',
    normal: '-0.022em', // Apple default
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.2em',    // For small caps/labels
  },
} as const;

// =============================================================================
// Spacing System - 8pt Grid
// =============================================================================

export const spacing = {
  0: '0',
  0.5: '0.125rem',   // 2px
  1: '0.25rem',      // 4px
  1.5: '0.375rem',   // 6px
  2: '0.5rem',       // 8px
  2.5: '0.625rem',   // 10px
  3: '0.75rem',      // 12px
  4: '1rem',         // 16px
  5: '1.25rem',      // 20px
  6: '1.5rem',       // 24px
  7: '1.75rem',      // 28px
  8: '2rem',         // 32px
  9: '2.25rem',      // 36px
  10: '2.5rem',      // 40px
  12: '3rem',        // 48px
  14: '3.5rem',      // 56px
  16: '4rem',        // 64px
  20: '5rem',        // 80px
  24: '6rem',        // 96px
  28: '7rem',        // 112px
  32: '8rem',        // 128px
  36: '9rem',        // 144px
  40: '10rem',       // 160px
  48: '12rem',       // 192px
  56: '14rem',       // 224px
  64: '16rem',       // 256px
} as const;

// =============================================================================
// Border Radius - Apple Style
// =============================================================================

export const borderRadius = {
  none: '0',
  sm: '0.375rem',    // 6px
  DEFAULT: '0.75rem', // 12px
  md: '0.75rem',     // 12px
  lg: '1.125rem',    // 18px
  xl: '1.5rem',      // 24px
  '2xl': '2rem',     // 32px
  '3xl': '2.5rem',   // 40px
  full: '9999px',    // Pill shape
} as const;

// =============================================================================
// Shadows - Layered for depth
// =============================================================================

export const shadows = {
  none: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  DEFAULT: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  
  // Glass/Glowing shadows
  glow: {
    primary: '0 0 30px rgba(0, 113, 227, 0.3)',
    accent: '0 0 30px rgba(139, 92, 246, 0.3)',
    white: '0 0 30px rgba(255, 255, 255, 0.1)',
  },
  
  // Card elevation
  card: {
    DEFAULT: '0 2px 8px rgba(0, 0, 0, 0.1)',
    hover: '0 12px 40px rgba(0, 0, 0, 0.3)',
  },
} as const;

// =============================================================================
// Animation Durations & Easings
// =============================================================================

export const animation = {
  // Durations (per ui-ux-pro-max: 150-300ms for micro-interactions)
  duration: {
    fastest: '100ms',
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
    slowest: '700ms',
  },

  // Easings - Natural feel
  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },

  // Keyframes
  keyframes: {
    fadeIn: {
      from: { opacity: '0' },
      to: { opacity: '1' },
    },
    fadeInUp: {
      from: { opacity: '0', transform: 'translateY(20px)' },
      to: { opacity: '1', transform: 'translateY(0)' },
    },
    fadeInDown: {
      from: { opacity: '0', transform: 'translateY(-20px)' },
      to: { opacity: '1', transform: 'translateY(0)' },
    },
    slideInLeft: {
      from: { opacity: '0', transform: 'translateX(-20px)' },
      to: { opacity: '1', transform: 'translateX(0)' },
    },
    slideInRight: {
      from: { opacity: '0', transform: 'translateX(20px)' },
      to: { opacity: '1', transform: 'translateX(0)' },
    },
    scaleIn: {
      from: { opacity: '0', transform: 'scale(0.95)' },
      to: { opacity: '1', transform: 'scale(1)' },
    },
    float: {
      '0%, 100%': { transform: 'translateY(0px)' },
      '50%': { transform: 'translateY(-10px)' },
    },
    pulse: {
      '0%, 100%': { opacity: '1' },
      '50%': { opacity: '0.5' },
    },
    shimmer: {
      '0%': { backgroundPosition: '-200% 0' },
      '100%': { backgroundPosition: '200% 0' },
    },
  },
} as const;

// =============================================================================
// Z-Index Scale (per ui-ux-pro-max: define scale 10, 20, 30, 50)
// =============================================================================

export const zIndex = {
  behind: -1,
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  overlay: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  toast: 80,
  max: 9999,
} as const;

// =============================================================================
// Breakpoints (Mobile-first)
// =============================================================================

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// =============================================================================
// Glass/Glassmorphism Effects
// =============================================================================

export const glass = {
  light: {
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'saturate(180%) blur(20px)',
    border: 'rgba(255, 255, 255, 0.2)',
  },
  dark: {
    background: 'rgba(10, 10, 10, 0.8)',
    backdropFilter: 'saturate(180%) blur(20px)',
    border: 'rgba(255, 255, 255, 0.08)',
  },
  card: {
    background: 'rgba(29, 29, 31, 0.9)',
    backdropFilter: 'blur(20px)',
    border: 'rgba(255, 255, 255, 0.08)',
  },
} as const;

// =============================================================================
// Component Tokens
// =============================================================================

export const components = {
  button: {
    sizes: {
      sm: { padding: '8px 16px', fontSize: '14px', borderRadius: '8px' },
      md: { padding: '12px 24px', fontSize: '17px', borderRadius: '980px' },
      lg: { padding: '16px 32px', fontSize: '17px', borderRadius: '980px' },
    },
  },
  
  card: {
    padding: {
      sm: '16px',
      md: '24px',
      lg: '32px',
    },
    borderRadius: {
      sm: '12px',
      md: '18px',
      lg: '24px',
    },
  },
  
  input: {
    sizes: {
      sm: { padding: '8px 12px', fontSize: '14px' },
      md: { padding: '12px 16px', fontSize: '16px' },
      lg: { padding: '16px 20px', fontSize: '17px' },
    },
    borderRadius: '12px',
  },
  
  modal: {
    sizes: {
      sm: '400px',
      md: '500px',
      lg: '650px',
      xl: '800px',
      full: '100%',
    },
    borderRadius: '24px',
    padding: '24px',
  },
} as const;

// =============================================================================
// Export all tokens
// =============================================================================

export const tokens = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animation,
  zIndex,
  breakpoints,
  glass,
  components,
} as const;

export default tokens;
