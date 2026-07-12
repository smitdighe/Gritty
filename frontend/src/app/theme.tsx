import { createContext, useContext, useEffect, type ReactNode } from 'react';

/**
 * Dark-first theme. The palette lives in Tailwind tokens (phase 1); this
 * provider only guarantees the `dark` class is present on <html> and exposes
 * the active theme via context. No light theme is shipped yet — the type keeps
 * the door open without wiring a toggle.
 */
export type Theme = 'dark';

const ThemeContext = createContext<Theme>('dark');

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  }, []);

  return <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
