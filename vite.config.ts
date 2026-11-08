import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Two entry points: the framework-agnostic core (`.`) and the React adapter
 * (`./react`). Vite emits the JS; `tsc -p tsconfig.build.json` emits the
 * `.d.ts` tree (the dts vite plugin pulls in api-extractor and a broken ajv
 * tree under this install, and tsc is both simpler and the type-check gate).
 */
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        react: resolve(__dirname, 'src/react.tsx'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime'],
      output: {
        exports: 'named',
      },
    },
  },
});
