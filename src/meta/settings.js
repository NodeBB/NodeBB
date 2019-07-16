'use strict';

var db = require('../database');
var plugins = require('../plugins');
var Meta = require('../meta');
var pubsub = require('../pubsub');

var Settings = module.exports;

Settings.get = async function (hash) {
	return await db.getObject('settings:' + hash) || {};
};

Settings.getOne = async function (hash, field) {
	return await db.getObjectField('settings:' + hash, field);
};

Settings.set = async function (hash, values, quiet) {
	quiet = quiet || false;

	await db.setObject('settings:' + hash, values);

	plugins.fireHook('action:settings.set', {
		plugin: hash,
		settings: values,
	});

	pubsub.publish('action:settings.set.' + hash, values);
	Meta.reloadRequired = !quiet;
};

Settings.setOne = async function (hash, field, value) {
	const data = {};
	data[field] = value;
	return await Settings.set(hash, data);
};

Settings.setOnEmpty = async function (hash, values) {
	const settings = await db.getObject('settings:' + hash) || {};
	var empty = {};

	Object.keys(values).forEach(function (key) {
		if (!settings.hasOwnProperty(key)) {
			empty[key] = values[key];
		}
	});

	if (Object.keys(empty).length) {
		return await Settings.set(hash, empty);
	}
};
