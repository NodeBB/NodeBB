'use strict';

var async = require('async'),
	winston = require('winston'),
	validator = require('validator');

var db = require('../database'),
	analytics = require('../analytics');

module.exports = function(Meta) {

	Meta.errors = {};

	Meta.errors.log404 = function(route, callback) {
		callback = callback || function() {};
		route = route.replace(/\/$/, '');	// remove trailing slashes
		analytics.increment('errors:404');
		db.sortedSetIncrBy('errors:404', 1, route, callback);
	};

	Meta.errors.get = function(escape, callback) {
		db.getSortedSetRevRangeByScoreWithScores('errors:404', 0, -1, '+inf', '-inf', function(err, data) {
			data = data.map(function(nfObject) {
				nfObject.value = escape ? validator.escape(nfObject.value) : nfObject.value;
				return nfObject;
			});

			callback(null, data);
		});
	};

	Meta.errors.clear = function(callback) {
		db.delete('errors:404', callback);
	};
};
