import {base} from './base';

module.exports = {
  ...base,
  overrides: [
    ...base.overrides,
    {
      files: ['**/*.ts', '**/*.tsx'],
      extends: ['plugin:react-hooks/recommended'],
      rules: {
        'react/react-in-jsx-scope': 'off',
        'react/require-default-props': 'off',
        'react/prop-types': 'off',

        'react-hooks/exhaustive-deps': 'warn',
      },
    },
  ],
};
