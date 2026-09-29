import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'reports', 'node_modules', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.strict.rules,
      // The virtual list's scrolling rowgroup must be focusable so keyboard users can scroll it (WCAG 2.1.1).
      'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['rowgroup'], tags: [] }],
    },
  },
  {
    files: ['bench/**/*.ts', 'scripts/**/*.ts', 'e2e/**/*.ts', '*.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // noUncheckedIndexedAccess is on, so bounds-checked indexing is asserted with `!` deliberately.
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  prettier,
);
