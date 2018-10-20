
'use strict';

var async = require('async');
var nconf = require('nconf');
var path = require('path');
var winston = require('winston');

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
		console.log(key, config[key], deserialized[key], typeof deserialized[key])
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
	Configs.getFields([], callback);
};

Configs.get = function (field, callback) {
	Configs.getFields([field], function (err, values) {
		callback(err, values ? values[field] : null);
	});
};

Configs.getFields = function (fields, callback) {
	async.waterfall([
		function (next) {
			if (fields.length) {
				db.getObjectFields('config', fields, next);
			} else {
				db.getObject('config', next);
			}
		},
		function (values, next) {
			try {
				values = deserialize(values || {});
			} catch (err) {
				return next(err);
			}
			if (!fields.length) {
				values.version = nconf.get('version');
				values.registry = nconf.get('registry');
			}
			next(null, values);
		},
	], callback);
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
					if (err && err.code === 'ENOENT') {
						// For whatever reason the x50 logo wasn't generated, gracefully error out
						winston.warn('[logo] The email-safe logo doesn\'t seem to have been created, please re-upload your site logo.');
						size = {
							height: 0,
							width: 0,
						};
					} else if (err) {
						return next(err);
					}

					data['brand:emailLogo:height'] = size.height;
					data['brand:emailLogo:width'] = size.width;
					next();
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
