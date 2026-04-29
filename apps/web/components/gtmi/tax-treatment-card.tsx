import * as React from 'react';
import { cn } from '@/lib/utils';
import { EmptyState } from './empty-state';
import type { CountryTaxTreatment } from '@/lib/queries/country-detail-types';

export interface TaxTreatmentCardProps {
  tax: CountryTaxTreatment;
  taxAuthorityUrl: string | null;
  className?: string;
}

/**
 * Two-column tax-treatment summary aggregating D.3.2 (special regime) and
 * D.3.3 (territorial vs worldwide) across the country's programmes. Reads
 * the pre-aggregated payload from `aggregateTaxTreatment` in country-detail
 * helpers; render branches:
 *   - both fields null → EmptyState placeholder.
 *   - either field populated → distribution rows with per-bucket counts.
 */
export function TaxTreatmentCard({ tax, taxAuthorityUrl, className }: TaxTreatmentCardProps) {
  const hasData = tax.taxationModel !== null || tax.specialRegime !== null;
  if (!hasData) {
    return (
      <EmptyState
        className={className}
        title="Data not yet collected"
        body={
          taxAuthorityUrl
            ? `D.3.2 and D.3.3 have not been extracted for this country's programmes yet. Source: ${taxAuthorityUrl}.`
            : 'D.3.2 and D.3.3 have not been extracted for this country’s programmes yet.'
        }
      />
    );
  }

  return (
    <div
      className={cn('grid grid-cols-1 gap-4 md:grid-cols-2', className)}
      data-testid="tax-treatment-card"
    >
      <TaxBucket
        title="Territorial vs worldwide"
        subtitle="Indicator D.3.3"
        distribution={tax.taxationModel}
        totalProgramsInCountry={tax.totalProgramsInCountry}
      />
      <TaxBucket
        title="Special regime"
        subtitle="Indicator D.3.2"
        distribution={tax.specialRegime}
        totalProgramsInCountry={tax.totalProgramsInCountry}
      />
    </div>
  );
}

function TaxBucket({
  title,
  subtitle,
  distribution,
  totalProgramsInCountry,
}: {
  title: string;
  subtitle: string;
  distribution: Record<string, number> | null;
  totalProgramsInCountry: number;
}) {
  return (
    <article className="border bg-paper p-4" style={{ borderColor: 'var(--rule)' }}>
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="serif text-ink" style={{ fontSize: 17, fontWeight: 500, margin: 0 }}>
          {title}
        </h3>
        <span className="num text-data-sm text-ink-4">{subtitle}</span>
      </header>
      {distribution === null || Object.keys(distribution).length === 0 ? (
        <p className="mt-2 italic text-data-sm text-ink-4">Data not yet collected.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {Object.entries(distribution).map(([label, count]) => (
            <li key={label} className="flex items-baseline justify-between gap-3 text-data-md">
              <span className="text-ink">{label}</span>
              <span className="num text-data-sm text-ink-4">
                {count} of {totalProgramsInCountry}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
