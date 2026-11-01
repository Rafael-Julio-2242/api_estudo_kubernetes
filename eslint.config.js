import tseslint from 'typescript-eslint'

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
    },
    languageOptions: {
      parserOptions: { project: './tsconfig.json' },
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'scripts/**', 'vitest.config.ts', 'eslint.config.js'],
  },
)
