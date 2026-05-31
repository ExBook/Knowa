import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        tutorial: resolve(root, 'tutorial.html'),
        demo: resolve(root, 'demo.html'),
        changelog: resolve(root, 'changelog.html'),
      },
    },
  },
});
