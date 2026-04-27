import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { resolveIso2 } from '@/lib/country-iso';

export interface CountryFlagProps {
  /** ISO-2 or ISO-3 country code, any case. */
  iso: string;
  /** Country name for the alt text and tooltip. */
  countryName?: string;
  /** Visual size — defaults to sm (16×12). */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE: Record<'sm' | 'md' | 'lg', { w: number; h: number; cls: string }> = {
  sm: { w: 16, h: 12, cls: 'h-3 w-4' },
  md: { w: 24, h: 18, cls: 'h-[18px] w-6' },
  lg: { w: 40, h: 30, cls: 'h-[30px] w-10' },
};

/**
 * Country flag rendered from a vendored SVG under /flags/{iso2}.svg.
 * Falls back to a globe glyph for ISOs not in the GTMI cohort
 * (resolveIso2 returns null) so the component never throws on input
 * — the unscored-country pages, the country dropdown, and other
 * surfaces all stay graceful.
 *
 * SVG assets vendored from the MIT-licensed flag-icons package
 * (https://github.com/lipis/flag-icons). License attribution lives in
 * apps/web/content/about.md.
 */
export function CountryFlag({ iso, countryName, size = 'sm', className }: CountryFlagProps) {
  const iso2 = resolveIso2(iso);
  const dims = SIZE[size];
  const alt = countryName ? `${countryName} flag` : `Flag of ${iso}`;

  if (!iso2) {
    return (
      <span
        role="img"
        title={alt}
        aria-label={alt}
        className={cn(
          'inline-flex items-center justify-center rounded-sm border border-border bg-muted text-muted-foreground',
          dims.cls,
          className
        )}
        data-testid="country-flag-fallback"
      >
        <GlobeGlyph />
      </span>
    );
  }

  return (
    <Image
      src={`/flags/${iso2}.svg`}
      alt={alt}
      width={dims.w}
      height={dims.h}
      unoptimized
      className={cn('inline-block rounded-sm border border-border', dims.cls, className)}
      data-testid="country-flag"
      data-iso={iso2}
    />
  );
}

function GlobeGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
    </svg>
  );
}
