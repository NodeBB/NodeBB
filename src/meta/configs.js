
'use strict';

const nconf = require('nconf');
const path = require('path');
const winston = require('winston');

const db = require('../database');
const pubsub = require('../pubsub');
const Meta = require('./index');
const cacheBuster = require('./cacheBuster');
const defaults = require('../../install/data/defaults.json');

const Configs = module.exports;

Meta.config = {};

// called after data is loaded from db
function deserialize(config) {
	const deserialized = {};
	Object.keys(config).forEach((key) => {
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
		} else if (Array.isArray(defaults[key]) && !Array.isArray(config[key])) {
			try {
				deserialized[key] = JSON.parse(config[key] || '[]');
			} catch (err) {
				winston.error(err.stack);
				deserialized[key] = defaults[key];
			}
		} else {
			deserialized[key] = config[key];
		}
	});
	return deserialized;
}

// called before data is saved to db
function serialize(config) {
	const serialized = {};
	Object.keys(config).forEach((key) => {
		const defaultType = typeof defaults[key];
		const type = typeof config[key];
		const number = parseFloat(config[key]);

		if (defaultType === 'string' && type === 'number') {
			serialized[key] = String(config[key]);
		} else if (defaultType === 'number' && type === 'string') {
			if (!isNaN(number) && isFinite(config[key])) {
				serialized[key] = number;
			} else {
				serialized[key] = defaults[key];
			}
		} else if (config[key] === null) {
			serialized[key] = defaults[key];
		} else if (defaultType === 'undefined' && !isNaN(number) && isFinite(config[key])) {
			serialized[key] = number;
		} else if (Array.isArray(defaults[key]) && Array.isArray(config[key])) {
			serialized[key] = JSON.stringify(config[key]);
		} else {
			serialized[key] = config[key];
		}
	});
	return serialized;
}

Configs.deserialize = deserialize;
Configs.serialize = serialize;

Configs.init = async function () {
	const config = await Configs.list();
	const buster = await cacheBuster.read();
	config['cache-buster'] = `v=${buster || Date.now()}`;
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
	await processConfig(data);
	data = serialize(data);
	await db.setObject('config', data);
	updateConfig(deserialize(data));
};

Configs.setOnEmpty = async function (values) {
	const data = await db.getObject('config');
	values = serialize(values);
	const config = { ...values, ...(data ? serialize(data) : {}) };
	await db.setObject('config', config);
};

Configs.remove = async function (field) {
	await db.deleteObjectField('config', field);
};

Configs.cookie = {
	get: () => {
		const cookie = {};

		if (nconf.get('cookieDomain') || Meta.config.cookieDomain) {
			cookie.domain = nconf.get('cookieDomain') || Meta.config.cookieDomain;
		}

		if (nconf.get('secure')) {
			cookie.secure = true;
		}

		const relativePath = nconf.get('relative_path');
		if (relativePath !== '') {
			cookie.path = relativePath;
		}

		// Ideally configurable from ACP, but cannot be "Strict" as then top-level access will treat it as guest.
		cookie.sameSite = 'Lax';

		return cookie;
	},
};

async function processConfig(data) {
	ensureInteger(data, 'maximumUsernameLength', 1);
	ensureInteger(data, 'minimumUsernameLength', 1);
	ensureInteger(data, 'minimumPasswordLength', 1);
	ensureInteger(data, 'maximumAboutMeLength', 0);
	if (data.minimumUsernameLength > data.maximumUsernameLength) {
		throw new Error('[[error:invalid-data]]');
	}
	require('../social').postSharing = null;
	await Promise.all([
		saveRenderedCss(data),
		getLogoSize(data),
	]);
}

function ensureInteger(data, field, min) {
	if (data.hasOwnProperty(field)) {
		data[field] = parseInt(data[field], 10);
		if (!(data[field] >= min)) {
			throw new Error('[[error:invalid-data]]');
		}
	}
}

async function saveRenderedCss(data) {
	if (!data.customCSS) {
		return;
	}
	const sass = require('../utils').getSass();
	const scssOutput = await sass.compileStringAsync(data.customCSS, {});
	data.renderedCustomCSS = scssOutput.css.toString();
}

async function getLogoSize(data) {
	const image = require('../image');
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

pubsub.on('config:update', (config) => {
	if (typeof config === 'object' && Meta.config) {
		updateLocalConfig(config);
	}
});
