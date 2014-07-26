
'use strict';

var winston = require('winston'),
	db = require('../database');

module.exports = function(Meta) {

	Meta.config = {};
	Meta.configs = {};

	Meta.configs.init = function (callback) {
		delete Meta.config;

		Meta.configs.list(function (err, config) {
			if (err) {
				winston.error(err);
				return callback(err);
			}

			Meta.config = config;
			callback();
		});
	};

	Meta.configs.list = function (callback) {
		db.getObject('config', function (err, config) {
			callback(err, config || {});
		});
	};

	Meta.configs.get = function (field, callback) {
		db.getObjectField('config', field, callback);
	};

	Meta.configs.getFields = function (fields, callback) {
		db.getObjectFields('config', fields, callback);
	};

	Meta.configs.set = function (field, value, callback) {
		callback = callback || function() {};
		if (!field) {
			return callback(new Error('invalid config field'));
		}

		db.setObjectField('config', field, value, function(err, res) {
			if (!err && Meta.config) {
				Meta.config[field] = value;
			}

			callback(err, res);
		});
	};

	Meta.configs.setOnEmpty = function (field, value, callback) {
		Meta.configs.get(field, function (err, curValue) {
			if (err) {
				return callback(err);
			}

			if (!curValue) {
				Meta.configs.set(field, value, callback);
			} else {
				callback();
			}
		});
	};

	Meta.configs.remove = function (field) {
		db.deleteObjectField('config', field);
	};

};