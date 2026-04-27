'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';

/**
 * Minimal three-state theme toggle: system → light → dark → system…
 * No icon library dependency — uses inline SVG so commit 2 stays slim.
 * Hydration-safe: returns a placeholder on the server, real button after mount.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        className="inline-flex h-8 w-8 items-center justify-center rounded-button border border-border text-muted-foreground"
      >
        <span className="block h-4 w-4 rounded-full bg-muted" aria-hidden />
      </button>
    );
  }

  const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
  const label = `Theme: ${theme ?? 'system'} (resolved: ${resolvedTheme}). Click for ${next}.`;
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(next)}
      className="inline-flex h-8 w-8 items-center justify-center rounded-button border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {isDark ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
    </button>
  );
}
