import eslint from '@eslint/js'
import stylisticPlugin from '@stylistic/eslint-plugin'
import importPlugin from 'eslint-plugin-import'
import prettierPlugin from 'eslint-plugin-prettier/recommended'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const tsconfigPath = './tsconfig.test.json'

export default [
  {
    ignores: [
      '.vscode/',
      '**/__tmp__/',
      '**/__test__/fixtures/',
      '**/coverage/',
      '**/lib/',
      '**/node_modules/',
    ],
  },
  eslint.configs.recommended,
  prettierPlugin,
  importPlugin.flatConfigs.errors,
  importPlugin.flatConfigs.warnings,
  {
    files: ['**/*.{mjs,ts}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    rules: {
      'array-callback-return': 'warn',
      eqeqeq: ['warn', 'smart'],
      'max-len': [
        'error',
        {
          code: 100,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
        },
      ],
      'no-console': 'off',
      'no-param-reassign': ['error', { props: true }],
      'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
      'no-return-assign': ['error', 'always'],
      'no-template-curly-in-string': 'warn',
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'never'],
      'sort-imports': ['error', { ignoreDeclarationSort: true }],
    },
  },
  ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: tsconfigPath,
      },
    },
    rules: {
      '@typescript-eslint/array-type': ['error', { default: 'array-simple', readonly: 'generic' }],
      '@typescript-eslint/consistent-type-definitions': ['warn', 'interface'],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', disallowTypeAnnotations: true },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowDirectConstAssertionInArrowFunctions: true,
          allowConciseArrowFunctionExpressionsStartingWithVoid: true,
        },
      ],
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        {
          accessibility: 'explicit',
          overrides: { constructors: 'no-public', parameterProperties: 'no-public' },
        },
      ],
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        { ignoreArrowShorthand: true, ignoreVoidOperator: true },
      ],
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-invalid-void-type': 'off',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksConditionals: true, checksVoidReturn: true },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/prefer-enum-initializers': 'error',
    },
  },
  {
    rules: {
      'import/first': 'error',
      'import/no-cycle': ['error', { ignoreExternal: true }],
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
      'import/no-self-import': 'error',
      'import/no-unresolved': 'off',
      'import/order': [
        'error',
        {
          alphabetize: { order: 'asc', caseInsensitive: true },
          groups: [['builtin', 'external'], 'internal', 'parent', 'sibling'],
          'newlines-between': 'never',
        },
      ],
    },
  },
  {
    files: ['**/*.ts'],
    plugins: { '@stylistic': stylisticPlugin },
    rules: {
      '@stylistic/member-delimiter-style': [
        'error',
        {
          multiline: { delimiter: 'none' },
          singleline: { delimiter: 'semi', requireLast: false },
        },
      ],
      '@stylistic/type-annotation-spacing': [
        'error',
        { before: false, after: true, overrides: { arrow: { before: true, after: true } } },
      ],
    },
  },
  {
    files: ['**/__test__/**/*.ts', 'vitest.helper.mts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'import/no-extraneous-dependencies': 'off',
      'no-plusplus': 'off',
      'no-template-curly-in-string': 'off',
    },
  },
  {
    files: ['**/constant.ts', '**/constant/**/*.ts'],
    rules: {
      '@typescript-eslint/prefer-literal-enum-member': 'off',
    },
  },
  {
    files: ['eslint.config.mjs', 'rollup.config.mjs'],
    rules: {
      'import/no-anonymous-default-export': 'off',
    },
  },
]
