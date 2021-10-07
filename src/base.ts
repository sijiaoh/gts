import * as cfg from '../.eslintrc.json';

export const base = {
  ...cfg,
  overrides: [
    ...cfg.overrides,
    {
      files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
      extends: ['plugin:import/recommended'],
      rules: {
        'import/no-default-export': 'error',
        'import/order': ['error', {alphabetize: {order: 'asc'}}],
      },
    },
    {
      files: ['**/*.ts', '**/*.tsx'],
      parserOptions: {
        project: 'tsconfig.json',
      },
      extends: ['plugin:import/typescript'],
      rules: {
        '@typescript-eslint/await-thenable': 'error',
        'require-await': 'off',
        '@typescript-eslint/require-await': 'error',
        '@typescript-eslint/no-misused-promises': 'error',
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/promise-function-async': 'error',
      },
    },
    {
      files: [
        'test/**/*.js',
        'test/**/*.jsx',
        'test/**/*.ts',
        'test/**/*.tsx',
        '**/*.test.js',
        '**/*.test.jsx',
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
      rules: {
        'node/no-unpublished-import': 'off',
      },
    },
  ],
};
