const react = require('./react');

module.exports = {
  ...react,
  overrides: [
    ...react.overrides,
    {
      files: ['**/*.ts', '**/*.tsx'],
      extends: ['next', 'next/core-web-vitals'],
    },
    {
      files: [
        'pages/**/*.ts',
        'pages/**/*.tsx',
        'src/pages/**/*.ts',
        'src/pages/**/*.tsx',
      ],
      rules: {
        'import/prefer-default-export': 'error',
        'import/no-default-export': 'off',
      },
    },
  ],
};
