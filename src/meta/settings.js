'use strict';

var db = require('../database'),
	plugins = require('../plugins');

module.exports = function(Meta) {

	Meta.settings = {};

	Meta.settings.get = function(hash, callback) {
		db.getObject('settings:' + hash, function(err, settings) {
			callback(err, settings || {});
		});
	};

	Meta.settings.getOne = function(hash, field, callback) {
		db.getObjectField('settings:' + hash, field, callback);
	};

	Meta.settings.set = function(hash, values, callback) {
		var key = 'settings:' + hash;
		db.setObject(key, values, function(err) {
			if (err) {
				return callback(err);
			}

			plugins.fireHook('action:settings.set', {
				plugin: hash,
				settings: values
			});

			Meta.reloadRequired = true;
			callback();
		});
	};

	Meta.settings.setOne = function(hash, field, value, callback) {
		db.setObjectField('settings:' + hash, field, value, callback);
	};

	Meta.settings.setOnEmpty = function (hash, field, value, callback) {
		Meta.settings.getOne(hash, field, function (err, curValue) {
			if (err) {
				return callback(err);
			}

			if (!curValue) {
				Meta.settings.setOne(hash, field, value, callback);
			} else {
				callback();
			}
		});
	};
};