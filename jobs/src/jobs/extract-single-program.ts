import { task } from '@trigger.dev/sdk/v3';
import { DiscoverStageImpl } from '@gtmi/extraction';

export const extractSingleProgram = task({
  id: 'extract-single-program',
  run: async (payload: { programId: string; programName: string; country: string }) => {
    const discover = new DiscoverStageImpl();
    const result = await discover.execute(payload.programId, payload.programName, payload.country);
    console.log(
      `Stage 0 complete for ${result.programId}: ${result.discoveredUrls.length} URLs discovered`
    );
    return result;
  },
});
