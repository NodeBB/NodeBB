
'use strict';

var async = require('async');
var nconf = require('nconf');

var db = require('../database');
var pubsub = require('../pubsub');
var cacheBuster = require('./cacheBuster');

module.exports = function (Meta) {

	Meta.config = {};
	Meta.configs = {};

	Meta.configs.init = function (callback) {
		delete Meta.config;

		async.waterfall([
			function (next) {
				Meta.configs.list(next);
			},
			function (config, next) {
				cacheBuster.read(function (err, buster) {
					if (err) {
						return next(err);
					}

					config['cache-buster'] = 'v=' + (buster || Date.now());

					Meta.config = config;
					next();
				});
			},
		], callback);
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
		callback = callback || function () {};
		if (!field) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		var data = {};
		data[field] = value;
		Meta.configs.setMultiple(data, callback);
	};


	Meta.configs.setMultiple = function (data, callback) {
		async.waterfall([
			function (next) {
				processConfig(data, next);
			},
			function (next) {
				db.setObject('config', data, next);
			},
			function (next) {
				updateConfig(data);
				setImmediate(next);
			},
		], callback);
	};

	function processConfig(data, callback) {
		if (data.customCSS) {
			return saveRenderedCss(data, callback);
		}
		setImmediate(callback);
	}

	function saveRenderedCss(data, callback) {
		var less = require('less');
		async.waterfall([
			function (next) {
				less.render(data.customCSS, {
					compress: true,
				}, next);
			},
			function (lessObject, next) {
				data.renderedCustomCSS = lessObject.css;
				setImmediate(next);
			},
		], callback);
	}

	function updateConfig(config) {
		pubsub.publish('config:update', config);
	}

	pubsub.on('config:update', function onConfigReceived(config) {
		if (typeof config === 'object' && Meta.config) {
			for (var field in config) {
				if (config.hasOwnProperty(field)) {
					Meta.config[field] = config[field];
				}
			}
		}
	});

	Meta.configs.setOnEmpty = function (values, callback) {
		async.waterfall([
			function (next) {
				db.getObject('config', next);
			},
			function (data, next) {
				data = data || {};
				var empty = {};
				Object.keys(values).forEach(function (key) {
					if (!data.hasOwnProperty(key)) {
						empty[key] = values[key];
					}
				});
				if (Object.keys(empty).length) {
					db.setObject('config', empty, next);
				} else {
					setImmediate(next);
				}
			},
		], callback);
	};

	Meta.configs.remove = function (field, callback) {
		db.deleteObjectField('config', field, callback);
	};

};
