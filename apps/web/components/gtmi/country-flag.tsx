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
  sm: { w: 22, h: 16, cls: 'h-4 w-[22px]' },
  md: { w: 28, h: 20, cls: 'h-5 w-7' },
  lg: { w: 40, h: 30, cls: 'h-[30px] w-10' },
};

/**
 * Country flag rendered from a vendored SVG under /flags/{iso2}.svg.
 *
 * Editorial restyle (Phase 4-A): falls back to the design's mono ISO-box
 * (paper-3 surface, monospace ISO-3 code) for unknown / out-of-cohort
 * countries — matches docs/design/primitives.jsx:CountryFlag.
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
          'inline-flex items-center justify-center border border-rule bg-paper-3 font-mono font-semibold text-ink-3',
          dims.cls,
          className
        )}
        style={{ fontSize: 9, letterSpacing: '0.5px' }}
        data-testid="country-flag-fallback"
      >
        {iso.slice(0, 3).toUpperCase()}
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
      className={cn('inline-block border border-rule', dims.cls, className)}
      data-testid="country-flag"
      data-iso={iso2}
    />
  );
}
