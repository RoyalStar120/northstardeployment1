/**
 * Shared Tailwind (Play CDN) theme for every Northstar page.
 * Load right after https://cdn.tailwindcss.com. Colors are the css/app.css tokens.
 */
window.tailwind = window.tailwind || {};
tailwind.config = {
  darkMode: 'class',
  // The Play CDN injects its CSS after css/app.css, so its preflight reset would
  // override component classes like .ns-btn. app.css carries its own base reset instead.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif']
      },
      // CSS variables from css/app.css, so utilities follow light and dark mode
      colors: {
        ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)' },
        muted: 'var(--muted)',
        cream: 'var(--cream)',
        paper: 'var(--paper)',
        sand: { DEFAULT: 'var(--sand)', deep: 'var(--sand-deep)' },
        line: 'var(--line)',
        amber: {
          DEFAULT: 'var(--amber)',
          deep: 'var(--amber-deep)',
          wash: 'var(--amber-wash)',
          line: 'var(--amber-line)',
          ink: 'var(--amber-ink)'
        },
        leaf: { DEFAULT: 'var(--leaf)', wash: 'var(--leaf-wash)', line: 'var(--leaf-line)' },
        danger: { DEFAULT: 'var(--danger)', wash: 'var(--danger-wash)', line: 'var(--danger-line)' }
      },
      borderRadius: {
        card: '18px',
        tile: '12px',
        field: '12px'
      },
      boxShadow: {
        card: 'none',
        lift: '0 1px 2px rgba(0,0,0,0.06), 0 6px 16px -8px rgba(0,0,0,0.22)',
        amber: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 10px 22px -10px rgba(214,146,20,0.7)'
      }
    }
  }
};
