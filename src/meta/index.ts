'use strict';

const Meta = {} as any;
import winston from 'winston';
import os from 'os';
import nconf from 'nconf';
import pubsub from '../pubsub';
import slugify from '../slugify';
import user from '../user';
import groups from '../groups';
import promisify from '../promisify';

Meta.reloadRequired = false;
Meta.themes = require('./themes').default;
Meta.js =  require('./js').default;
Meta.css = require('./css').default;
Meta.settings = require('./settings').default;
Meta.logs = require('./logs').default;
Meta.errors = require('./errors').default;
Meta.tags = require('./tags').default;
Meta.dependencies = require('./dependencies').default;
Meta.templates = require('./templates').default;
Meta.blacklist = require('./blacklist').default;
Meta.languages = require('./languages').default;

/* Assorted */
Meta.userOrGroupExists = async function (slug) {
	if (!slug) {
		throw new Error('[[error:invalid-data]]');
	}
	slug = slugify(slug);
	const [userExists, groupExists] = await Promise.all([
		user.existsBySlug(slug),
		groups.existsBySlug(slug),
	]);
	return userExists || groupExists;
};

if (nconf.get('isPrimary')) {
	pubsub.on('meta:restart', (data) => {
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
	if ((process as any).send) {
		(process as any).send({
			action: 'restart',
		});
	} else {
		winston.error('[meta.restart] Could not restart, are you sure NodeBB was started with `./nodebb start`?');
	}
}

Meta.getSessionTTLSeconds = function () {
	const ttlDays = 60 * 60 * 24 * Meta.config.loginDays;
	const ttlSeconds = Meta.config.loginSeconds;
	const ttl = ttlSeconds || ttlDays || 1209600; // Default to 14 days
	return ttl;
};

promisify(Meta);
export default Meta;
