import { defineConfig } from '@trigger.dev/sdk/v3';

export default defineConfig({
  project: 'proj_wqkutxouuojvjdzsqopp',
  dirs: ['./src/jobs'],
  maxDuration: 300,
  build: {
    extensions: [],
    conditions: ['node', 'require', 'default'],
    external: ['import-in-the-middle'],
  },
});
