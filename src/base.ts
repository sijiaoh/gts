import * as cfg from '../.eslintrc.json';

export const base = {
  ...cfg,
  overrides: [
    ...cfg.overrides,
    {
      files: ['**/*.ts', '**/*.tsx'],
      parserOptions: {
        project: 'tsconfig.json',
      },
      rules: {
        '@typescript-eslint/await-thenable': 'error',
        'require-await': 'off',
        '@typescript-eslint/require-await': 'error',
        '@typescript-eslint/no-misused-promises': 'error',
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/promise-function-async': 'error',
      },
    },
  ],
};
