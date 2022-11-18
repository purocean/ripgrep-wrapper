import typescript from 'rollup-plugin-typescript2';
import { visualizer } from 'rollup-plugin-visualizer';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/index.ts',
  plugins: [
    typescript({
      useTsconfigDeclarationDir: true,
    }),
    visualizer(),
    terser()
  ],
  output: [
    {
      format: 'cjs',
      file: 'lib/bundle.cjs.js',
      sourcemap: true
    },
    {
      format: 'es',
      file: 'lib/bundle.esm.js',
      sourcemap: true
    }
  ]
};
