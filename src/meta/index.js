'use strict';

var async = require('async');
var winston = require('winston');
var os = require('os');
var nconf = require('nconf');

var pubsub = require('../pubsub');
var utils = require('../utils');

var Meta = module.exports;

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
Meta.userOrGroupExists = function (slug, callback) {
	var user = require('../user');
	var groups = require('../groups');
	slug = utils.slugify(slug);
	async.parallel([
		async.apply(user.existsBySlug, slug),
		async.apply(groups.existsBySlug, slug),
	], function (err, results) {
		callback(err, results ? results.some(function (result) { return result; }) : false);
	});
};

if (nconf.get('isPrimary') === 'true') {
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
