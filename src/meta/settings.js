'use strict';

var async = require('async');

var db = require('../database');
var plugins = require('../plugins');
var meta = require('../meta');

var settings = module.exports;

settings.get = function (hash, callback) {
	db.getObject('settings:' + hash, function (err, settings) {
		callback(err, settings || {});
	});
};

settings.getOne = function (hash, field, callback) {
	db.getObjectField('settings:' + hash, field, callback);
};

settings.set = function (hash, values, callback) {
	async.waterfall([
		function (next) {
			db.setObject('settings:' + hash, values, next);
		},
		function (next) {
			plugins.fireHook('action:settings.set', {
				plugin: hash,
				settings: values,
			});

			meta.reloadRequired = true;
			next();
		},
	], callback);
};

settings.setOne = function (hash, field, value, callback) {
	db.setObjectField('settings:' + hash, field, value, callback);
};

settings.setOnEmpty = function (hash, values, callback) {
	async.waterfall([
		function (next) {
			db.getObject('settings:' + hash, next);
		},
		function (settings, next) {
			settings = settings || {};
			var empty = {};
			Object.keys(values).forEach(function (key) {
				if (!settings.hasOwnProperty(key)) {
					empty[key] = values[key];
				}
			});

			if (Object.keys(empty).length) {
				db.setObject('settings:' + hash, empty, next);
			} else {
				next();
			}
		},
	], callback);
};
