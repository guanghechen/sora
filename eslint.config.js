import ghcConfigs from '@guanghechen/eslint-config'

export default [
  {
    ignores: [
      '.DS_Store',
      '**/*.hbs',
      '.vscode/',
      '**/.husky/',
      '**/.nx/',
      '**/.git/',
      '**/.yarn/',
      '**/__tmp__/',
      '**/__test__/cases/',
      '**/__test__/fixtures/',
      '**/coverage/',
      '**/dist/',
      '**/doc/',
      '**/example/',
      '**/lib/',
      '**/node_modules/',
      '**/resources/',
      '**/test/',
    ],
  },
  ...ghcConfigs,
]
