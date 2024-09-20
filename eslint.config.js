import ghcConfigs from '@guanghechen/eslint-config'

export default [
  {
    ignores: ['.vscode/', '**/__tmp__/', '**/doc/', '**/example/'],
  },
  ...ghcConfigs,
]
