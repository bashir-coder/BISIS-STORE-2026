module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'commonjs',
  },
  extends: ['eslint:recommended'],
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['node_modules/', 'coverage/'],
}
