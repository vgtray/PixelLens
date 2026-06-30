// eslint.config.js — Flat config ESLint 10 pour PixelLens (extension Chrome MV3).
// Couvre : TypeScript strict + React 19 (JSX runtime) + globals chrome/browser/service worker.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  // Dossiers ignorés globalement.
  { ignores: ['dist/', 'node_modules/'] },

  // Recommandations de base JavaScript.
  js.configs.recommended,

  // Recommandations TypeScript (parser + règles).
  ...tseslint.configs.recommended,

  // Sources React 19 (TS/TSX).
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser, // window, document, fetch…
        ...globals.serviceworker, // self, caches… (background MV3)
        ...globals.webextensions, // chrome, browser
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    // Version React pinnée (pas 'detect') : eslint-plugin-react 7.37.5 appelle
    // context.getFilename() dans sa détection de version — API retirée par ESLint 10.
    settings: { react: { version: '19.2' } },
    rules: {
      // React recommandé + transform JSX automatique (React 19 : pas d'import React requis).
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      // Hooks — référencés par nom pour rester stables d'une version de plugin à l'autre.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Args/vars préfixés `_` ignorés volontairement (convention du code pour les
      // callbacks d'events MV3 dont certains paramètres ne sont pas consommés).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },

  // Tests Vitest — `any` toléré pour les mocks (chrome.*, fetch, modules…).
  {
    files: ['src/**/__tests__/**/*.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
