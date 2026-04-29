import 'dotenv/config';
import { client, db, fieldDefinitions, fieldValues } from '@gtmi/db';
import { and, eq, inArray } from 'drizzle-orm';

const PROGRAM_ID = 'b72e8153-6c3f-4c11-9a90-72cd7cc3c81d';

async function main() {
  const rows = await db
    .select({
      key: fieldDefinitions.key,
      raw: fieldValues.valueRaw,
      norm: fieldValues.valueNormalized,
      status: fieldValues.status,
      prov: fieldValues.provenance,
    })
    .from(fieldValues)
    .innerJoin(fieldDefinitions, eq(fieldDefinitions.id, fieldValues.fieldDefinitionId))
    .where(
      and(
        eq(fieldValues.programId, PROGRAM_ID),
        inArray(fieldDefinitions.key, ['A.1.1', 'A.1.2', 'D.1.2', 'D.2.2'])
      )
    );
  console.log('key | status | raw | normalized | extractionModel | valueCurrency');
  for (const r of rows.sort((a, b) => a.key.localeCompare(b.key))) {
    const p = (r.prov ?? {}) as Record<string, unknown>;
    console.log(
      [
        r.key,
        r.status,
        (r.raw ?? '').toString().slice(0, 40),
        JSON.stringify(r.norm)?.slice(0, 40),
        p['extractionModel'] as string,
        (p['valueCurrency'] as string) ?? '-',
      ].join(' | ')
    );
  }
}

main()
  .then(async () => {
    await client.end({ timeout: 5 });
  })
  .catch(async (err) => {
    console.error(err);
    try {
      await client.end({ timeout: 5 });
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
