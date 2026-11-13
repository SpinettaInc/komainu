import js from '@eslint/js';
import globals from 'globals';
import stylistic from '@stylistic/eslint-plugin';

// Same rule set as the other Spinetta JavaScript projects.
const rules = {
    'eqeqeq': ['error', 'always'],
    'no-var': 'error',
    'prefer-const': 'error',
    'no-unused-vars': ['error', { caughtErrors: 'none' }],
    'no-implicit-globals': 'error',
    'no-shadow': 'error',
    'no-else-return': 'error',
    'no-useless-concat': 'error',
    'no-throw-literal': 'error',
    'consistent-return': 'off',
    // Formatting.
    '@stylistic/indent': ['error', 4, { SwitchCase: 1 }],
    '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
    '@stylistic/semi': ['error', 'always'],
    '@stylistic/comma-dangle': ['error', 'never'],
    '@stylistic/no-trailing-spaces': 'error',
    '@stylistic/eol-last': ['error', 'always'],
    '@stylistic/no-multiple-empty-lines': ['error', { max: 1 }],
    '@stylistic/keyword-spacing': 'error',
    '@stylistic/space-before-blocks': 'error',
    '@stylistic/object-curly-spacing': ['error', 'always'],
    '@stylistic/arrow-spacing': 'error',
    '@stylistic/comma-spacing': 'error',
    '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }]
};

export default [
    { ignores: ['public/**', '**/node_modules/**', 'coverage/**'] },
    js.configs.recommended,
    { plugins: { '@stylistic': stylistic } },
    {
        // Shared core: runs in the browser and in Node, so it may use neither's globals.
        files: ['src/core/**/*.js'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { TextEncoder: 'readonly', TextDecoder: 'readonly', atob: 'readonly', btoa: 'readonly' } },
        rules
    },
    {
        // Browser scripts.
        files: ['src/web/**/*.js'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.browser },
        rules
    },
    {
        // Node: the CLI, the MCP server, build scripts, tests and this file.
        files: ['src/cli/**/*.{js,mjs}', 'scripts/**/*.mjs', 'test/**/*.mjs', '*.mjs'],
        languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.node },
        rules
    }
];
