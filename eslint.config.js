//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  ...tanstackConfig,
  {
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
    },
  },
  {
    ignores: [
      'eslint.config.js',
      'prettier.config.js',
      // Artefacts de build : présents dès qu'un `npm run build` a tourné, et
      // absents du tsconfig, ce qui fait échouer les règles typées.
      '.output',
      '.nitro',
      '.tanstack',
      'dist',
      // Généré par drizzle-kit.
      'src/db/migrations',
    ],
  },
]
