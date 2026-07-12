/**
 * Minimal className joiner. Accepts strings, falsy values (skipped), and
 * records mapping class -> boolean. No dependency on clsx/tailwind-merge;
 * later-wins duplicate resolution is not attempted (keep call sites clean).
 */
export type ClassValue = string | number | false | null | undefined | Record<string, boolean>;

export function cn(...parts: ClassValue[]): string {
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (typeof part === 'string' || typeof part === 'number') {
      out.push(String(part));
    } else {
      for (const [key, on] of Object.entries(part)) {
        if (on) out.push(key);
      }
    }
  }
  return out.join(' ');
}
