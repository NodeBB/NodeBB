"use strict";

var app,
	middleware = {},
	nconf = require('nconf'),
	user = require('./../user'),
	plugins = require('./../plugins');


middleware.isAdmin = function (req, res, next) {
	user.isAdministrator((req.user && req.user.uid) ? req.user.uid : 0, function (err, isAdmin) {
		if (!isAdmin) {
			res.status(403);
			res.redirect('/403');
		} else {
			next();
		}
	});
};

middleware.buildHeader = function (req, res, callback) {
	var custom_header = {
		'plugins': [],
		'authentication': []
	};

	user.getUserFields(req.user.uid, ['username', 'userslug', 'picture'], function(err, userData) {
		plugins.fireHook('filter:admin.header.build', custom_header, function(err, custom_header) {
			callback(err, templates['admin/header'].parse({
				csrf: res.locals.csrf_token,
				relative_path: nconf.get('relative_path'),
				plugins: custom_header.plugins,
				authentication: custom_header.authentication,
				userpicture: userData.picture,
				username: userData.username,
				userslug: userData.userslug,
				'cache-buster': meta.config['cache-buster'] ? 'v=' + meta.config['cache-buster'] : '',
				env: process.env.NODE_ENV ? true : false
			}));
		});
	});
};



module.exports = function(webserver) {
	app = webserver;
	return middleware;
};