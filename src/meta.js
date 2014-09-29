"use strict";

var async = require('async'),
	winston = require('winston'),
	templates = require('templates.js'),

	user = require('./user'),
	groups = require('./groups'),
	plugins = require('./plugins'),
	emitter = require('./emitter'),
	auth = require('./routes/authentication');

(function (Meta) {
	Meta.restartRequired = false;

	require('./meta/configs')(Meta);
	require('./meta/themes')(Meta);
	require('./meta/title')(Meta);
	require('./meta/js')(Meta);
	require('./meta/css')(Meta);
	require('./meta/sounds')(Meta);
	require('./meta/settings')(Meta);
	Meta.templates = require('./meta/templates');

	/* Assorted */
	Meta.userOrGroupExists = function(slug, callback) {
		async.parallel([
			async.apply(user.exists, slug),
			async.apply(groups.exists, slug)
		], function(err, results) {
			callback(err, results ? results.some(function(result) { return result; }) : false);
		});
	};

	Meta.reload = function(callback) {
		async.series([
			async.apply(plugins.reload),
			function(next) {
				async.parallel([
					async.apply(Meta.js.minify, false),
					async.apply(Meta.css.minify),
					async.apply(Meta.templates.compile),
					async.apply(auth.reloadRoutes),
					async.apply(templates.flush)
				], next);
			}
		], function(err) {
			if (!err) {
				emitter.emit('nodebb:ready');
			}

			if (callback) callback.apply(null, arguments);
		});
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
