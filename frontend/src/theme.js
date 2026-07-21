// Theme switching. A theme is a set of CSS variable overrides on <html>
// (see index.css), so switching is one attribute change - no re-render, no
// flash, and every component follows automatically.

const THEME_KEY = 'pos_theme'

export const THEMES = [
  { id: 'light', label: 'Hell', swatch: '#0e7d8a' },
  { id: 'dark', label: 'Dunkel', swatch: '#171a21' },
  { id: 'rose', label: 'Rosé', swatch: '#c2508b' },
]

export function loadTheme() {
  return localStorage.getItem(THEME_KEY) || 'light'
}

export function applyTheme(id) {
  // 'light' is the base stylesheet, so it carries no attribute at all
  if (id === 'light') {
    delete document.documentElement.dataset.theme
  } else {
    document.documentElement.dataset.theme = id
  }
  localStorage.setItem(THEME_KEY, id)
}

// Called once before React mounts so the saved theme is on screen immediately
// instead of flashing the default first.
export function initTheme() {
  applyTheme(loadTheme())
}
