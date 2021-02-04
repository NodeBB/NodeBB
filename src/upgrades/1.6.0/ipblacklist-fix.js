'use strict';

const async = require('async');

const db = require('../../database');

module.exports = {
	name: 'Changing ip blacklist storage to object',
	timestamp: Date.UTC(2017, 8, 7),
	method: function (callback) {
		let rules;
		async.waterfall([
			function (next) {
				db.get('ip-blacklist-rules', next);
			},
			function (_rules, next) {
				rules = _rules;
				db.delete('ip-blacklist-rules', rules ? next : callback);
			},
			function (next) {
				db.setObject('ip-blacklist-rules', { rules: rules }, next);
			},
		], callback);
	},
};
