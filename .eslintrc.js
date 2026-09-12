'use strict';

module.exports = {
  root: true,
  extends: ['eslint:recommended', 'prettier'],
  env: {
    node: true,
    es2023: true,
  },
  overrides: [
    {
      files: ['widgets/*/public/*.js'],
      env: { browser: true },
    },
    {
      files: ['*.js', '*.mjs'],
      rules: {
        'no-unused-vars': ['warn', { args: 'none' }],
      },
    },
  ],
  ignorePatterns: ['/examples/**', '/examples-v1/**', 'build'],
};
