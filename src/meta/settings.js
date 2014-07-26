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
		hash = 'settings:' + hash;
		db.setObject(hash, values, function(err) {
			if (!err) {
				plugins.fireHook('action:settings.set', hash, values);
			}

			callback.apply(this, arguments);
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