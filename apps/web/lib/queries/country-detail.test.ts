import { describe, it, expect } from 'vitest';
import { aggregateTaxTreatment, type FieldValueAggregate } from './country-detail-helpers';

describe('aggregateTaxTreatment', () => {
  it('returns null fields and totalProgramsInCountry when no values present', () => {
    const out = aggregateTaxTreatment([], 5);
    expect(out.taxationModel).toBeNull();
    expect(out.specialRegime).toBeNull();
    expect(out.totalProgramsInCountry).toBe(5);
  });

  it('counts approved D.3.3 raw values into the taxationModel bucket', () => {
    const fvs: FieldValueAggregate[] = [
      { fieldKey: 'D.3.3', valueRaw: 'territorial', status: 'approved' },
      { fieldKey: 'D.3.3', valueRaw: 'territorial', status: 'approved' },
      { fieldKey: 'D.3.3', valueRaw: 'worldwide', status: 'approved' },
    ];
    const out = aggregateTaxTreatment(fvs, 3);
    expect(out.taxationModel).toEqual({ territorial: 2, worldwide: 1 });
    expect(out.specialRegime).toBeNull();
  });

  it('counts approved D.3.2 raw values into the specialRegime bucket', () => {
    const fvs: FieldValueAggregate[] = [
      { fieldKey: 'D.3.2', valueRaw: 'available', status: 'approved' },
      { fieldKey: 'D.3.2', valueRaw: 'not available', status: 'approved' },
    ];
    const out = aggregateTaxTreatment(fvs, 2);
    expect(out.specialRegime).toEqual({ available: 1, 'not available': 1 });
    expect(out.taxationModel).toBeNull();
  });

  it('aggregates both indicators independently in the same call', () => {
    const fvs: FieldValueAggregate[] = [
      { fieldKey: 'D.3.3', valueRaw: 'worldwide', status: 'approved' },
      { fieldKey: 'D.3.2', valueRaw: 'available', status: 'approved' },
      { fieldKey: 'D.3.3', valueRaw: 'territorial', status: 'approved' },
    ];
    const out = aggregateTaxTreatment(fvs, 4);
    expect(out.taxationModel).toEqual({ worldwide: 1, territorial: 1 });
    expect(out.specialRegime).toEqual({ available: 1 });
  });

  it('ignores non-approved rows (the public dashboard surfaces approved data only)', () => {
    const fvs: FieldValueAggregate[] = [
      { fieldKey: 'D.3.3', valueRaw: 'territorial', status: 'pending_review' },
      { fieldKey: 'D.3.3', valueRaw: 'worldwide', status: 'rejected' },
      { fieldKey: 'D.3.3', valueRaw: 'territorial', status: 'approved' },
    ];
    const out = aggregateTaxTreatment(fvs, 3);
    expect(out.taxationModel).toEqual({ territorial: 1 });
  });

  it('ignores rows with null or empty raw values', () => {
    const fvs: FieldValueAggregate[] = [
      { fieldKey: 'D.3.3', valueRaw: null, status: 'approved' },
      { fieldKey: 'D.3.3', valueRaw: '', status: 'approved' },
      { fieldKey: 'D.3.3', valueRaw: '   ', status: 'approved' },
      { fieldKey: 'D.3.3', valueRaw: 'territorial', status: 'approved' },
    ];
    const out = aggregateTaxTreatment(fvs, 4);
    expect(out.taxationModel).toEqual({ territorial: 1 });
  });

  it('ignores rows for unrelated indicators', () => {
    const fvs: FieldValueAggregate[] = [
      { fieldKey: 'A.1.1', valueRaw: '50000', status: 'approved' },
      { fieldKey: 'D.3.3', valueRaw: 'territorial', status: 'approved' },
    ];
    const out = aggregateTaxTreatment(fvs, 2);
    expect(out.taxationModel).toEqual({ territorial: 1 });
    expect(out.specialRegime).toBeNull();
  });

  it('preserves the totalProgramsInCountry independently of how many values were collected', () => {
    const fvs: FieldValueAggregate[] = [
      { fieldKey: 'D.3.3', valueRaw: 'territorial', status: 'approved' },
    ];
    const out = aggregateTaxTreatment(fvs, 12);
    expect(out.totalProgramsInCountry).toBe(12);
  });

  it('trims whitespace from raw values so "territorial " and "territorial" bucket together', () => {
    const fvs: FieldValueAggregate[] = [
      { fieldKey: 'D.3.3', valueRaw: 'territorial', status: 'approved' },
      { fieldKey: 'D.3.3', valueRaw: ' territorial ', status: 'approved' },
    ];
    const out = aggregateTaxTreatment(fvs, 2);
    expect(out.taxationModel).toEqual({ territorial: 2 });
  });
});
