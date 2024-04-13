import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      entry: './src/index.ts',
      formats: ['cjs', 'es'],
      name: 'Musubi',
      fileName: 'index',
    },
  },
  plugins: [
    dts({
      include: 'src',
      tsconfigPath: 'tsconfig.lib.json',
    }),
  ],
});
