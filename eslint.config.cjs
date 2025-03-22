'use strict';
const serverConfig = require('eslint-config-nodebb');
const publicConfig = require('eslint-config-nodebb/public');

const { configs } = require('@eslint/js');
const globals = require('globals');

module.exports = [
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
	configs.recommended,
	{
		rules: {
			'no-bitwise': 'warn',
			'no-await-in-loop': 'warn',
		}
	},
	// tests
	{
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
			},
	  	},
		rules: {
	  		'no-unused-vars': 'off',
			'no-prototype-builtins': 'off',
		}
  	},
	...publicConfig,
	...serverConfig
];

