'use strict';

import json from '@eslint/json';
import serverConfig from 'eslint-config-nodebb';
import publicConfig from 'eslint-config-nodebb/public';
import commonRules from 'eslint-config-nodebb/common';

import { defineConfig } from 'eslint/config';
import stylisticJs from '@stylistic/eslint-plugin'
import js from '@eslint/js';
import globals from 'globals';

import i18nPlural from './scripts/i18n-plural.js';

export default defineConfig([
	{
		ignores: [
			'node_modules/',
			'.project',
			'.vagrant',
			'.DS_Store',
			'.tx',
			'logs/',
			'public/uploads/',
			'public/vendor/',
			'.idea/',
			'.vscode/',
			'*.ipr',
			'*.iws',
			'coverage/',
			'build/',
			'test/files/',
			'*.min.js',
			'install/docker/',
		],
	},
	// tests
	{
		plugins: {
			js,
			'@stylistic/js': stylisticJs,
		},
		extends: ['js/recommended'],
		files: ['test/**/*.js'],
		languageOptions: {
			ecmaVersion: 2020,
			sourceType: 'commonjs',
			globals: {
				...globals.node,
				...globals.browser,
				it: 'readonly',
				describe: 'readonly',
				before: 'readonly',
				beforeEach: 'readonly',
				after: 'readonly',
				afterEach: 'readonly',
				nodebb: 'readonly',
			},
		},
		rules: {
			...commonRules,
			'no-unused-vars': 'off',
			'no-prototype-builtins': 'off',
		}
	},
	...publicConfig,
	...serverConfig,
	{
		plugins: {
			json,
			nodebb: {
				rules: {
					'i18n-icu-plural': {
						meta: { type: 'suggestion', schema: [] },
						create(context) {
							return {
								Member(node) {
									if (node.value && node.value.type === 'String' && i18nPlural.isPluralHack(node.value.value)) {
										context.report({
											node: node.value,
											message: i18nPlural.describeString(node.name.value),
										});
									}
								},
							};
						},
					},
					'i18n-icu-syntax': {
						meta: { type: 'problem', schema: [] },
						create(context) {
							return {
								Member(node) {
									if (node.value && node.value.type === 'String' && node.value.value.includes('{')) {
										const problem = i18nPlural.validateICU(node.value.value);
										if (problem) {
											context.report({
												node: node.value,
												message: `Invalid ICU syntax in "${node.name.value}": ${problem}`,
											});
										}
									}
								},
							};
						},
					},
				},
			},
		},
		files: ['public/language/en-GB/**/*.json'],
		language: 'json/json',
		rules: {
			'nodebb/i18n-icu-plural': 'warn',
			'nodebb/i18n-icu-syntax': 'error',
		},
	},
	{
		rules: {
			'preserve-caught-error': 'off'
		}
	},
	{
		files: [
			'nodebb-global.js',
		],
		languageOptions: {
			sourceType: 'module',
		}
	}
]);

