
'use strict';

var async = require('async');
var nconf = require('nconf');

var db = require('../database');
var pubsub = require('../pubsub');
var Meta = require('../meta');
var cacheBuster = require('./cacheBuster');

var configs = module.exports;
Meta.config = {};

configs.init = function (callback) {
	Meta.config = null;

	async.waterfall([
		function (next) {
			configs.list(next);
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

configs.list = function (callback) {
	db.getObject('config', function (err, config) {
		config = config || {};
		config.version = nconf.get('version');
		config.registry = nconf.get('registry');
		callback(err, config);
	});
};

configs.get = function (field, callback) {
	db.getObjectField('config', field, callback);
};

configs.getFields = function (fields, callback) {
	db.getObjectFields('config', fields, callback);
};

configs.set = function (field, value, callback) {
	callback = callback || function () {};
	if (!field) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var data = {};
	data[field] = value;
	configs.setMultiple(data, callback);
};


configs.setMultiple = function (data, callback) {
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
	updateLocalConfig(config);
	pubsub.publish('config:update', config);
}

function updateLocalConfig(config) {
	for (var field in config) {
		if (config.hasOwnProperty(field)) {
			Meta.config[field] = config[field];
		}
	}
}

pubsub.on('config:update', function onConfigReceived(config) {
	if (typeof config === 'object' && Meta.config) {
		updateLocalConfig(config);
	}
});

configs.setOnEmpty = function (values, callback) {
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

configs.remove = function (field, callback) {
	db.deleteObjectField('config', field, callback);
};
