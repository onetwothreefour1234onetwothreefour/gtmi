import 'dotenv/config';
import { db } from './packages/db/src/client';
import { fieldValues } from './packages/db/src/schema';

(async () => {
  const rows = await db.select().from(fieldValues);
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
})();
