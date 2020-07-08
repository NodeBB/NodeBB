'use strict';

const winston = require('winston');
const os = require('os');
const nconf = require('nconf');

const pubsub = require('../pubsub');
const utils = require('../utils');

const Meta = module.exports;

Meta.reloadRequired = false;

Meta.configs = require('./configs');
Meta.themes = require('./themes');
Meta.js = require('./js');
Meta.css = require('./css');
Meta.sounds = require('./sounds');
Meta.settings = require('./settings');
Meta.logs = require('./logs');
Meta.errors = require('./errors');
Meta.tags = require('./tags');
Meta.dependencies = require('./dependencies');
Meta.templates = require('./templates');
Meta.blacklist = require('./blacklist');
Meta.languages = require('./languages');


/* Assorted */
Meta.userOrGroupExists = async function (slug) {
	const user = require('../user');
	const groups = require('../groups');
	slug = utils.slugify(slug);
	const [userExists, groupExists] = await Promise.all([
		user.existsBySlug(slug),
		groups.existsBySlug(slug),
	]);
	return userExists || groupExists;
};

if (nconf.get('isPrimary')) {
	pubsub.on('meta:restart', function (data) {
		if (data.hostname !== os.hostname()) {
			restart();
		}
	});
}

Meta.restart = function () {
	pubsub.publish('meta:restart', { hostname: os.hostname() });
	restart();
};

function restart() {
	if (process.send) {
		process.send({
			action: 'restart',
		});
	} else {
		winston.error('[meta.restart] Could not restart, are you sure NodeBB was started with `./nodebb start`?');
	}
}

Meta.getSessionTTLSeconds = function () {
	var ttlDays = 60 * 60 * 24 * Meta.config.loginDays;
	var ttlSeconds = Meta.config.loginSeconds;
	var ttl = ttlSeconds || ttlDays || 1209600; // Default to 14 days
	return ttl;
};

Meta.async = require('../promisify')(Meta);
