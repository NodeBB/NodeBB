'use strict';

var async = require('async');
var db = require('../../database');


module.exports = {
	name: 'Rename maximumImageWidth to resizeImageWidth',
	timestamp: Date.UTC(2018, 9, 24),
	method: function (callback) {
		const meta = require('../../meta');
		async.waterfall([
			function (next) {
				meta.configs.get('maximumImageWidth', next);
			},
			function (value, next) {
				meta.configs.set('resizeImageWidth', value, next);
			},
			function (next) {
				db.deleteObjectField('config', 'maximumImageWidth', next);
			},
		], callback);
	},
};
