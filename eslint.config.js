import { genConfigs } from '@guanghechen/eslint-config'

export default [
  {
    ignores: ['.vscode/', '**/__tmp__/', '**/doc/', '**/example/', 'pnpm-lock.yaml'],
  },
  ...genConfigs({ tsconfigPath: './tsconfig.test.json' }),
]
