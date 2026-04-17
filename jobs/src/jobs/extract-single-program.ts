import { task } from '@trigger.dev/sdk/v3';
import type { ExtractionInput } from '@gtmi/extraction';

export const extractSingleProgram = task({
  id: 'extract-single-program',
  run: async (payload: Pick<ExtractionInput, 'programId'>) => {
    console.log(`extract-single-program: programId=${payload.programId} — not yet implemented`);
  },
});
