/**
 * Pure helpers for /countries/[iso]. Split out so tests can import without
 * 'server-only'.
 */

import type { CountryTaxTreatment } from './country-detail-types';

export interface FieldValueAggregate {
  fieldKey: string;
  valueRaw: string | null;
  status: string;
}

/**
 * Aggregate a country's tax-treatment posture from per-program field values.
 *
 *   D.3.3 — Territorial vs worldwide taxation
 *   D.3.2 — Special regime availability
 *
 * Only `status='approved'` rows count toward the distribution — the public
 * dashboard surfaces approved data. Each unique raw value is bucketed into
 * a count.
 *
 * Returns null fields when no approved values exist for the relevant
 * indicators in this country, so the page can render the "Data not yet
 * collected" placeholder rather than an empty bar chart.
 */
export function aggregateTaxTreatment(
  fieldValues: FieldValueAggregate[],
  totalProgramsInCountry: number
): CountryTaxTreatment {
  const taxationCounts = bucketize(fieldValues, 'D.3.3');
  const regimeCounts = bucketize(fieldValues, 'D.3.2');
  return {
    taxationModel: Object.keys(taxationCounts).length === 0 ? null : taxationCounts,
    specialRegime: Object.keys(regimeCounts).length === 0 ? null : regimeCounts,
    totalProgramsInCountry,
  };
}

function bucketize(fieldValues: FieldValueAggregate[], fieldKey: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const fv of fieldValues) {
    if (fv.fieldKey !== fieldKey) continue;
    if (fv.status !== 'approved') continue;
    if (fv.valueRaw === null) continue;
    const trimmed = fv.valueRaw.trim();
    if (!trimmed) continue;
    out[trimmed] = (out[trimmed] ?? 0) + 1;
  }
  return out;
}
