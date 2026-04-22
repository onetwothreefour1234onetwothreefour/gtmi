import { task } from '@trigger.dev/sdk/v3';
import { db, programs } from '@gtmi/db';
import { eq, inArray } from 'drizzle-orm';
import { extractSingleProgram } from './extract-single-program';

interface BatchPayload {
  /** ISO3 country codes to process, e.g. ["SGP", "GBR"]. Omit for all active programs. */
  countryCodes?: string[];
  /** Explicit program IDs — overrides countryCodes if provided. */
  programIds?: string[];
}

interface BatchResult {
  triggered: number;
  skipped: number;
  runIds: string[];
}

export const extractBatch = task({
  id: 'extract-batch',
  // Higher maxDuration: orchestrator just fans out and collects results.
  maxDuration: 300,
  run: async (payload: BatchPayload): Promise<BatchResult> => {
    // Resolve which programs to run.
    let targetPrograms: Array<{ id: string; name: string; countryIso: string }> = [];

    if (payload.programIds && payload.programIds.length > 0) {
      targetPrograms = await db
        .select({ id: programs.id, name: programs.name, countryIso: programs.countryIso })
        .from(programs)
        .where(inArray(programs.id, payload.programIds));
    } else if (payload.countryCodes && payload.countryCodes.length > 0) {
      targetPrograms = await db
        .select({ id: programs.id, name: programs.name, countryIso: programs.countryIso })
        .from(programs)
        .where(inArray(programs.countryIso, payload.countryCodes));
    } else {
      // Default: all active programs.
      targetPrograms = await db
        .select({ id: programs.id, name: programs.name, countryIso: programs.countryIso })
        .from(programs)
        .where(eq(programs.status, 'active'));
    }

    if (targetPrograms.length === 0) {
      console.log('No programs matched — nothing to trigger.');
      return { triggered: 0, skipped: 0, runIds: [] };
    }

    console.log(`Triggering extraction for ${targetPrograms.length} program(s):`);
    for (const p of targetPrograms) {
      console.log(`  ${p.countryIso} — ${p.name} (${p.id})`);
    }

    // Fan out: trigger one run per program. Trigger.dev handles concurrency limits.
    const batchItems = targetPrograms.map((p) => ({
      payload: { programId: p.id, programName: p.name, country: p.countryIso },
    }));

    const batchResult = await extractSingleProgram.batchTrigger(batchItems);

    const runIds = batchResult.runs.map((r) => r.id);
    console.log(`Triggered ${runIds.length} runs. IDs: ${runIds.join(', ')}`);

    return {
      triggered: runIds.length,
      skipped: targetPrograms.length - runIds.length,
      runIds,
    };
  },
});
