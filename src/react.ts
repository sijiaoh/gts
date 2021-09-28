import {base} from './base';

module.exports = {
  ...base,
  overrides: [
    ...base.overrides,
    {
      files: ['**/*.ts', '**/*.tsx'],
      extends: ['plugin:react-hooks/recommended'],
    },
  ],
};
