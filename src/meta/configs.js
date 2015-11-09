
'use strict';

var winston = require('winston'),
	db = require('../database'),
	pubsub = require('../pubsub'),
	nconf = require('nconf'),
	utils = require('../../public/src/utils');

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

			config['cache-buster'] = utils.generateUUID();

			Meta.config = config;
			callback();
		});
	};

	Meta.configs.list = function (callback) {
		db.getObject('config', function (err, config) {
			config = config || {};
			config.version = nconf.get('version');
			config.registry = nconf.get('registry');
			callback(err, config);
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
		processConfig(data, function(err) {
			if (err) {
				return callback(err);
			}
			db.setObject('config', data, function(err) {
				if (err) {
					return callback(err);
				}

				updateConfig(data);
				callback();
			});
		});
	};

	function processConfig(data, callback) {
		if (data.customCSS) {
			saveRenderedCss(data, callback);
			return;
		}
		callback();
	}

	function saveRenderedCss(data, callback) {
		var less = require('less');
		less.render(data.customCSS, {
			compress: true
		}, function(err, lessObject) {
			if (err) {
				winston.error('[less] Could not convert custom LESS to CSS! Please check your syntax.');
				return callback(null, '');
			}
			data.renderedCustomCSS = lessObject.css;
			callback();
		});
	}

	function updateConfig(config) {
		pubsub.publish('config:update', config);
	}

	pubsub.on('config:update', function onConfigReceived(config) {
		if (typeof config !== 'object' || !Meta.config) {
			return;
		}

		for(var field in config) {
			if(config.hasOwnProperty(field)) {
				Meta.config[field] = config[field];
			}
		}
	});

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