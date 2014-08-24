"use strict";

var async = require('async'),
	winston = require('winston'),
	user = require('./user'),
	groups = require('./groups');


(function (Meta) {
	Meta.restartRequired = false;

	require('./meta/configs')(Meta);
	require('./meta/themes')(Meta);
	require('./meta/title')(Meta);
	require('./meta/js')(Meta);
	require('./meta/css')(Meta);
	require('./meta/sounds')(Meta);
	require('./meta/settings')(Meta);


	/* Assorted */
	Meta.userOrGroupExists = function(slug, callback) {
		async.parallel([
			async.apply(user.exists, slug),
			async.apply(groups.exists, slug)
		], function(err, results) {
			callback(err, results ? results.some(function(result) { return result; }) : false);
		});
	};

	Meta.reload = function(step) {
		// 1. Reload plugins and associated routes
		// 2. Minify scripts and css, update cache buster
	};

	Meta.restart = function() {
		if (process.send) {
			process.send({
				action: 'restart'
			});
		} else {
			winston.error('[meta.restart] Could not restart, are you sure NodeBB was started with `./nodebb start`?');
		}
	};
}(exports));
