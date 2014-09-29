
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
				winston.error(err.stack);
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

		db.setObjectField('config', field, value, function(err) {
			if (err) {
				return callback(err);
			}
			var data = {};
			data[field] = value;
			updateConfig(data);

			callback();
		});
	};

	Meta.configs.setMultiple = function(data, callback) {
		db.setObject('config', data, function(err) {
			if (err) {
				return callback(err);
			}

			updateConfig(data);
			callback();
		});
	};

	function updateConfig(data) {
		var msg = {action: 'config:update', data: data};
		if (process.send) {
			process.send(msg);
		} else {
			onMessage(msg);
		}
	}

	process.on('message', onMessage);

	function onMessage(msg) {
		if (typeof msg !== 'object') {
			return;
		}

		if (msg.action === 'config:update' && Meta.config) {
			for(var field in msg.data) {
				if(msg.data.hasOwnProperty(field)) {
					Meta.config[field] = msg.data[field];
				}
			}
		}
	}

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