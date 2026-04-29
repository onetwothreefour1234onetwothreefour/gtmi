/**
 * Phase 4-A redesign: dark mode dropped (analyst Q2). The toggle button
 * is a no-op so the existing `(public)/layout.tsx` import compiles
 * unchanged — Phase A is not allowed to touch (public) page files. The
 * shim is removed when Phase B rewrites `(public)/layout.tsx` to use the
 * new `<TopNav>` and `<GtmiFooter>` components, at which point
 * `ThemeToggle` is no longer imported.
 */
export function ThemeToggle() {
  return null;
}
