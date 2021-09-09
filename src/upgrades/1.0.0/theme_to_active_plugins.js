'use strict';

var async = require('async');
var db = require('../../database');


module.exports = {
	name: 'Adding theme to active plugins sorted set',
	timestamp: Date.UTC(2015, 11, 23),
	method: function (callback) {
		async.waterfall([
			async.apply(db.getObjectField, 'config', 'theme:id'),
			async.apply(db.sortedSetAdd, 'plugins:active', 0),
		], callback);
	},
};
