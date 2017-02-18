'use strict';

var async = require('async');

var db = require('../database');
var plugins = require('../plugins');

module.exports = function (Meta) {

	Meta.settings = {};

	Meta.settings.get = function (hash, callback) {
		db.getObject('settings:' + hash, function (err, settings) {
			callback(err, settings || {});
		});
	};

	Meta.settings.getOne = function (hash, field, callback) {
		db.getObjectField('settings:' + hash, field, callback);
	};

	Meta.settings.set = function (hash, values, callback) {
		async.waterfall([
			function (next) {
				db.setObject('settings:' + hash, values, next);
			},
			function (next) {
				plugins.fireHook('action:settings.set', {
					plugin: hash,
					settings: values,
				});

				Meta.reloadRequired = true;
				next();
			},
		], callback);
	};

	Meta.settings.setOne = function (hash, field, value, callback) {
		db.setObjectField('settings:' + hash, field, value, callback);
	};

	Meta.settings.setOnEmpty = function (hash, values, callback) {
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
};