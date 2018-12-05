'use strict';

var async = require('async');
var db = require('../../database');


module.exports = {
	name: 'Revising minimum password strength to 1 (from 0)',
	timestamp: Date.UTC(2018, 1, 21),
	method: function (callback) {
		async.waterfall([
			async.apply(db.getObjectField.bind(db), 'config', 'minimumPasswordStrength'),
			function (strength, next) {
				if (!strength) {
					return db.setObjectField('config', 'minimumPasswordStrength', 1, next);
				}

				setImmediate(next);
			},
		], callback);
	},
};
