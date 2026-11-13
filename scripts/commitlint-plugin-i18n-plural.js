'use strict';

const { describeOffenders, stagedSourceStrings } = require('./i18n-plural.js');

module.exports = {
	rules: {
		// commitlint calls rules as rule(parsed, when, value); this rule inspects the
		// staged diff, so none of the commit message arguments are needed.
		'i18n-icu-plural': function () {
			const offenders = stagedSourceStrings();
			if (offenders.length === 0) {
				return [true];
			}

			return [false, describeOffenders(offenders)];
		},
	},
};
