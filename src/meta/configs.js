
'use strict';

const nconf = require('nconf');
const path = require('path');
const winston = require('winston');
const util = require('util');

const db = require('../database');
const pubsub = require('../pubsub');
const Meta = require('../meta');
const cacheBuster = require('./cacheBuster');
const defaults = require('../../install/data/defaults');

var Configs = module.exports;

Meta.config = {};

function deserialize(config) {
	var deserialized = {};
	Object.keys(config).forEach(function (key) {
		const defaultType = typeof defaults[key];
		const type = typeof config[key];
		const number = parseFloat(config[key]);

		if (defaultType === 'string' && type === 'number') {
			deserialized[key] = String(config[key]);
		} else if (defaultType === 'number' && type === 'string') {
			if (!isNaN(number) && isFinite(config[key])) {
				deserialized[key] = number;
			} else {
				deserialized[key] = defaults[key];
			}
		} else if (config[key] === 'true') {
			deserialized[key] = true;
		} else if (config[key] === 'false') {
			deserialized[key] = false;
		} else if (config[key] === null) {
			deserialized[key] = defaults[key];
		} else if (defaultType === 'undefined' && !isNaN(number) && isFinite(config[key])) {
			deserialized[key] = number;
		} else {
			deserialized[key] = config[key];
		}
	});
	return deserialized;
}

Configs.deserialize = deserialize;

Configs.init = async function () {
	const config = await Configs.list();
	const buster = await cacheBuster.read();
	config['cache-buster'] = 'v=' + (buster || Date.now());
	Meta.config = config;
};

Configs.list = async function () {
	return await Configs.getFields([]);
};

Configs.get = async function (field) {
	const values = await Configs.getFields([field]);
	return (values.hasOwnProperty(field) && values[field] !== undefined) ? values[field] : null;
};

Configs.getFields = async function (fields) {
	let values;
	if (fields.length) {
		values = await db.getObjectFields('config', fields);
	} else {
		values = await db.getObject('config');
	}

	values = { ...defaults, ...(values ? deserialize(values) : {}) };

	if (!fields.length) {
		values.version = nconf.get('version');
		values.registry = nconf.get('registry');
	}
	return values;
};

Configs.set = async function (field, value) {
	if (!field) {
		throw new Error('[[error:invalid-data]]');
	}

	await Configs.setMultiple({
		[field]: value,
	});
};

Configs.setMultiple = async function (data) {
	data = deserialize(data);
	await processConfig(data);
	await db.setObject('config', data);
	updateConfig(data);
};

Configs.setOnEmpty = async function (values) {
	const data = await db.getObject('config');
	const config = { ...values, ...(data ? deserialize(data) : {}) };
	await db.setObject('config', config);
};

Configs.remove = async function (field) {
	await db.deleteObjectField('config', field);
};

async function processConfig(data) {
	await Promise.all([
		saveRenderedCss(data),
		getLogoSize(data),
	]);
}

function lessRender(string, callback) {
	var less = require('less');
	less.render(string, {
		compress: true,
		javascriptEnabled: true,
	}, callback);
}

const lessRenderAsync = util.promisify(lessRender);

async function saveRenderedCss(data) {
	if (!data.customCSS) {
		return;
	}

	const lessObject = await lessRenderAsync(data.customCSS);
	data.renderedCustomCSS = lessObject.css;
}

async function getLogoSize(data) {
	var image = require('../image');
	if (!data['brand:logo']) {
		return;
	}
	let size;
	try {
		size = await image.size(path.join(nconf.get('upload_path'), 'system', 'site-logo-x50.png'));
	} catch (err) {
		if (err.code === 'ENOENT') {
			// For whatever reason the x50 logo wasn't generated, gracefully error out
			winston.warn('[logo] The email-safe logo doesn\'t seem to have been created, please re-upload your site logo.');
			size = {
				height: 0,
				width: 0,
			};
		} else {
			throw err;
		}
	}
	data['brand:emailLogo'] = nconf.get('url') + path.join(nconf.get('upload_url'), 'system', 'site-logo-x50.png');
	data['brand:emailLogo:height'] = size.height;
	data['brand:emailLogo:width'] = size.width;
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
