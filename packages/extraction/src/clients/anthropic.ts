import Anthropic from '@anthropic-ai/sdk';

export const MODEL_EXTRACTION = 'claude-opus-4-7' as const;
export const MODEL_DISCOVERY = 'claude-opus-4-7' as const;
export const MODEL_SUMMARY = 'claude-sonnet-4-6' as const;

export type ExtractionModel =
  | typeof MODEL_EXTRACTION
  | typeof MODEL_DISCOVERY
  | typeof MODEL_SUMMARY;

export function createAnthropicClient(): Anthropic {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  return new Anthropic({ apiKey });
}
