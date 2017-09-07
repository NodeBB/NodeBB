'use strict';

var async = require('async');

var db = require('../../database');

module.exports = {
	name: 'Changing ip blacklist storage to object',
	timestamp: Date.UTC(2017, 8, 7),
	method: function (callback) {
		var rules;
		async.waterfall([
			function (next) {
				db.get('ip-blacklist-rules', next);
			},
			function (_rules, next) {
				rules = _rules;
				if (!rules) {
					return callback();
				}
				db.delete('ip-blacklist-rules', next);
			},
			function (next) {
				db.setObject('ip-blacklist-rules', { rules: rules }, next);
			},
		], callback);
	},
};
