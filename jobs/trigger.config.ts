import { defineConfig } from '@trigger.dev/sdk/v3';

export default defineConfig({
  project: 'gtmi',
  dirs: ['./src/jobs'],
  maxDuration: 300,
});
