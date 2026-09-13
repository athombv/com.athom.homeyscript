'use strict';

module.exports = {
  root: true,
  extends: ['eslint:recommended', 'prettier'],
  env: {
    node: true,
    es2023: true,
  },
  overrides: [
    { files: ['**/*.mjs'], parserOptions: { sourceType: 'module' } },
    {
      files: ['widgets/*/public/*.js', 'playground/*.js', 'widget-renderer/*.js'],
      env: { browser: true },
    },
    {
      files: ['*.js', '*.mjs'],
      rules: {
        'no-unused-vars': ['warn', { args: 'none' }],
      },
    },
    {
      files: [
        'lib/Widget*.js',
        'lib/ScriptWidgets.js',
        'widget-renderer/*.js',
        'widget-renderer/*.mjs',
        'widgets/*/public/*.js',
        'playground/*.js',
        'scripts/*.mjs',
        'test/widget-*.test.js',
        'test/helpers/widget-dom.js',
      ],
      rules: {
        'arrow-body-style': ['error', 'always'],
        curly: ['error', 'all'],
        'no-nested-ternary': 'error',
      },
    },
  ],
  ignorePatterns: [
    '**/*.ts',
    '/examples/**',
    '/examples-v1/**',
    'build',
    'widgets/*/public/widget-markdown.js',
  ],
};
