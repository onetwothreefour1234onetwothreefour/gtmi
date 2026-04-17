import { test } from 'node:test';
import * as assert from 'node:assert';
import { methodologyV1 } from '../methodology-v1';

const EPSILON = 0.0001; // For floating point comparisons

function isClose(a: number, b: number) {
  return Math.abs(a - b) < EPSILON;
}

test('Methodology V1 Arithmetic Constraints', async (t) => {
  await t.test('pillar_weights sum to 1.0', () => {
    const sum = Object.values(methodologyV1.pillar_weights).reduce((a, b) => a + b, 0);
    assert.ok(isClose(sum, 1.0), `Pillar weights sum to ${sum}, expected 1.0`);
  });

  await t.test('Within each pillar, sub_factor_weights sum to 1.0', () => {
    const pillars = Object.keys(methodologyV1.framework_structure);
    for (const pillar of pillars) {
      const subFactors = Object.keys(
        (methodologyV1.framework_structure as Record<string, Record<string, string[]>>)[pillar]
      );
      let sum = 0;
      for (const sf of subFactors) {
        sum += (methodologyV1.sub_factor_weights as Record<string, number>)[sf];
      }
      assert.ok(
        isClose(sum, 1.0),
        `Sub-factor weights for pillar ${pillar} sum to ${sum}, expected 1.0`
      );
    }
  });

  await t.test('Within each sub_factor, indicator_weights sum to 1.0', () => {
    const subFactors = Object.keys(methodologyV1.sub_factor_weights);
    for (const sf of subFactors) {
      const indicatorKeys = methodologyV1.indicators
        .filter((i) => i.subFactor === sf)
        .map((i) => i.key);
      let sum = 0;
      for (const key of indicatorKeys) {
        sum += (methodologyV1.indicator_weights as Record<string, number>)[key];
      }
      assert.ok(
        isClose(sum, 1.0),
        `Indicator weights for sub-factor ${sf} sum to ${sum}, expected 1.0`
      );
    }
  });

  await t.test('Total indicator count is exactly 48', () => {
    // Note: The prompt requested 49, but METHODOLOGY.md explicitly defines 48 indicators.
    assert.strictEqual(methodologyV1.indicators.length, 48);
  });

  await t.test('cme_paq_split sums to 1.0', () => {
    const sum = methodologyV1.cme_paq_split.cme + methodologyV1.cme_paq_split.paq;
    assert.ok(isClose(sum, 1.0), `CME/PAQ split sums to ${sum}, expected 1.0`);
  });
});
