import { useEffect, useState } from 'react';

/** Reactively track a CSS media query. SSR-safe (defaults to false). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    // Re-read immediately, and once more after first paint, in case the initial
    // useState ran before the viewport settled (embedded/preview panes).
    onChange();
    const raf = requestAnimationFrame(onChange);
    mql.addEventListener('change', onChange);
    // Belt-and-suspenders: some environments (embedded/preview panes) settle the
    // viewport after mount without firing a media-query change — resync on resize.
    window.addEventListener('resize', onChange);
    return () => {
      cancelAnimationFrame(raf);
      mql.removeEventListener('change', onChange);
      window.removeEventListener('resize', onChange);
    };
  }, [query]);

  return matches;
}
