"use strict";

var async = require('async');
var winston = require('winston');

var os = require('os');
var nconf = require('nconf');
var user = require('./user');
var groups = require('./groups');
var pubsub = require('./pubsub');
var utils = require('../public/src/utils');

(function (Meta) {
	Meta.reloadRequired = false;

	require('./meta/configs')(Meta);
	require('./meta/themes')(Meta);
	require('./meta/js')(Meta);
	require('./meta/css')(Meta);
	require('./meta/sounds')(Meta);
	require('./meta/settings')(Meta);
	require('./meta/logs')(Meta);
	require('./meta/errors')(Meta);
	require('./meta/tags')(Meta);
	require('./meta/dependencies')(Meta);
	Meta.templates = require('./meta/templates');
	Meta.blacklist = require('./meta/blacklist');

	/* Assorted */
	Meta.userOrGroupExists = function(slug, callback) {
		slug = utils.slugify(slug);
		async.parallel([
			async.apply(user.existsBySlug, slug),
			async.apply(groups.existsBySlug, slug)
		], function(err, results) {
			callback(err, results ? results.some(function(result) { return result; }) : false);
		});
	};

	/**
	 * Reload deprecated as of v1.1.2+, remove in v2.x
	 */
	Meta.reload = function(callback) {
		restart();
		callback();
	};

	Meta.restart = function() {
		pubsub.publish('meta:restart', {hostname: os.hostname()});
		restart();
	};

	if (nconf.get('isPrimary') === 'true') {
		pubsub.on('meta:restart', function(data) {
			if (data.hostname !== os.hostname()) {
				restart();
			}
		});
	}

	function restart() {
		if (process.send) {
			process.send({
				action: 'restart'
			});
		} else {
			winston.error('[meta.restart] Could not restart, are you sure NodeBB was started with `./nodebb start`?');
		}
	}
}(exports));
