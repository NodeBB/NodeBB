'use strict';

var async = require('async');
var winston = require('winston');
var os = require('os');
var nconf = require('nconf');

var pubsub = require('./pubsub');
var utils = require('./utils');

var Meta = module.exports;

Meta.reloadRequired = false;

Meta.configs = require('./meta/configs');
Meta.themes = require('./meta/themes');
Meta.js = require('./meta/js');
Meta.css = require('./meta/css');
Meta.sounds = require('./meta/sounds');
Meta.settings = require('./meta/settings');
Meta.logs = require('./meta/logs');
Meta.errors = require('./meta/errors');
Meta.tags = require('./meta/tags');
Meta.dependencies = require('./meta/dependencies');
Meta.templates = require('./meta/templates');
Meta.blacklist = require('./meta/blacklist');
Meta.languages = require('./meta/languages');

/* Assorted */
Meta.userOrGroupExists = function (slug, callback) {
	var user = require('./user');
	var groups = require('./groups');
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
	var ttlDays = 60 * 60 * 24 * (parseInt(Meta.config.loginDays, 10) || 0);
	var ttlSeconds = (parseInt(Meta.config.loginSeconds, 10) || 0);
	var ttl = ttlSeconds || ttlDays || 1209600; // Default to 14 days
	return ttl;
};
