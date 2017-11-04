
'use strict';

var async = require('async');
var nconf = require('nconf');
var path = require('path');

var db = require('../database');
var pubsub = require('../pubsub');
var Meta = require('../meta');
var cacheBuster = require('./cacheBuster');

var Configs = module.exports;

Meta.config = {};

function serialize(config) {
	var serialized = {};
	Object.keys(config).forEach(function (key) {
		serialized[key] = JSON.stringify(config[key]);
	});
	return serialized;
}
function deserialize(config) {
	var deserialized = {};
	Object.keys(config).forEach(function (key) {
		deserialized[key] = JSON.parse(config[key]);
	});
	return deserialized;
}

Configs.init = function (callback) {
	var config;
	async.waterfall([
		function (next) {
			Configs.list(next);
		},
		function (_config, next) {
			config = _config;
			cacheBuster.read(next);
		},
		function (buster, next) {
			config['cache-buster'] = 'v=' + (buster || Date.now());
			Meta.config = config;
			next();
		},
	], callback);
};

Configs.list = function (callback) {
	db.getObject('config', function (err, config) {
		if (err) {
			return callback(err);
		}

		try {
			config = deserialize(config || {});
		} catch (e) {
			return callback(e);
		}
		config.version = nconf.get('version');
		config.registry = nconf.get('registry');
		callback(null, config);
	});
};

Configs.get = function (field, callback) {
	db.getObjectField('config', field, function (err, value) {
		if (err) {
			return callback(err);
		}

		try {
			value = JSON.parse(value);
		} catch (e) {
			return callback(e);
		}
		callback(null, value);
	});
};

Configs.getFields = function (fields, callback) {
	db.getObjectFields('config', fields, function (err, values) {
		if (err) {
			return callback(err);
		}

		try {
			values = deserialize(values || {});
		} catch (e) {
			return callback(e);
		}
		callback(null, values);
	});
};

Configs.set = function (field, value, callback) {
	callback = callback || function () {};
	if (!field) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var data = {};
	data[field] = value;
	Configs.setMultiple(data, callback);
};


Configs.setMultiple = function (data, callback) {
	async.waterfall([
		function (next) {
			processConfig(data, next);
		},
		function (next) {
			db.setObject('config', serialize(data), next);
		},
		function (next) {
			updateConfig(data);
			setImmediate(next);
		},
	], callback);
};

Configs.setOnEmpty = function (values, callback) {
	async.waterfall([
		function (next) {
			db.getObject('config', next);
		},
		function (data, next) {
			var config = Object.assign({}, values, deserialize(data || {}));
			db.setObject('config', serialize(config), next);
		},
	], callback);
};

Configs.remove = function (field, callback) {
	db.deleteObjectField('config', field, callback);
};

function processConfig(data, callback) {
	async.parallel([
		async.apply(saveRenderedCss, data),
		function (next) {
			var image = require('../image');
			if (data['brand:logo']) {
				image.size(path.join(nconf.get('upload_path'), 'system', 'site-logo-x50.png'), function (err, size) {
					data['brand:emailLogo:height'] = size.height;
					data['brand:emailLogo:width'] = size.width;
					next(err);
				});
			} else {
				setImmediate(next);
			}
		},
	], function (err) {
		callback(err);
	});
}

function saveRenderedCss(data, callback) {
	if (!data.customCSS) {
		return setImmediate(callback);
	}

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
	Object.assign(Meta.config, config);
}

pubsub.on('config:update', function onConfigReceived(config) {
	if (typeof config === 'object' && Meta.config) {
		updateLocalConfig(config);
	}
});
