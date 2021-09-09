'use strict';

var async = require('async');
var db = require('../../database');

module.exports = {
	name: 'Fix incorrect robots.txt schema',
	timestamp: Date.UTC(2017, 6, 10),
	method: function (callback) {
		async.waterfall([
			function (next) {
				db.getObject('config', next);
			},
			function (config, next) {
				if (!config) {
					return callback();
				}
				// fix mongo nested data
				if (config.robots && config.robots.txt) {
					db.setObjectField('config', 'robots:txt', config.robots.txt, next);
				} else if (typeof config['robots.txt'] === 'string' && config['robots.txt']) {
					db.setObjectField('config', 'robots:txt', config['robots.txt'], next);
				} else {
					next();
				}
			},
			function (next) {
				db.deleteObjectField('config', 'robots', next);
			},
			function (next) {
				db.deleteObjectField('config', 'robots.txt', next);
			},
		], callback);
	},
};
