import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Never lint generated output or third-party dirs
  globalIgnores(['dist/**', 'coverage/**', 'node_modules/**']),

  // ── Frontend (React / browser) ──────────────────────────────────────
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // React Compiler rules (react-hooks v7+) — disable until the project opts into the compiler
      'react-hooks/react-compiler': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
    },
  },

  // ── Server (Node.js) ────────────────────────────────────────────────
  {
    files: ['server/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  // ── Root config files & test/e2e (Node.js) ──────────────────────────
  {
    files: [
      '*.config.{js,cjs,mjs}',
      'e2e/**/*.js',
      '**/__tests__/**/*.{js,jsx}',
      '**/test/**/*.{js,jsx}',
      'vitest.*.js',
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    },
  },
])
