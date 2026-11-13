'use strict';

const i18nPlural = require('./scripts/commitlint-plugin-i18n-plural.js');

module.exports = {
	extends: ['@commitlint/config-angular'],
	plugins: [i18nPlural],
	rules: {
		'i18n-icu-plural': [1, 'always'],
		'header-max-length': [1, 'always', 72],
		'type-enum': [
			2,
			'always',
			[
				'breaking',
				'build',
				'chore',
				'ci',
				'docs',
				'feat',
				'fix',
				'perf',
				'refactor',
				'revert',
				'style',
				'test',
			],
		],
	},
};
