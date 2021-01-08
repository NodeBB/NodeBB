'use strict';

module.exports = {
	extends: ['@commitlint/config-angular'],
	rules: {
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
