"use strict";

var app;
var middleware = {
	admin: {}
};
var async = require('async');
var fs = require('fs');
var path = require('path');
var csrf = require('csurf');
var _ = require('underscore');

var validator = require('validator');
var nconf = require('nconf');
var ensureLoggedIn = require('connect-ensure-login');
var toobusy = require('toobusy-js');

var plugins = require('../plugins');
var languages = require('../languages');
var meta = require('../meta');
var user = require('../user');
var groups = require('../groups');

var analytics = require('../analytics');

var controllers = {
	api: require('./../controllers/api'),
	helpers: require('../controllers/helpers')
};

toobusy.maxLag(parseInt(meta.config.eventLoopLagThreshold, 10) || 100);
toobusy.interval(parseInt(meta.config.eventLoopInterval, 10) || 500);

middleware.authenticate = function(req, res, next) {
	if (req.user) {
		return next();
	} else if (plugins.hasListeners('action:middleware.authenticate')) {
		return plugins.fireHook('action:middleware.authenticate', {
			req: req,
			res: res,
			next: next
		});
	}

	controllers.helpers.notAllowed(req, res);
};

middleware.applyCSRF = csrf();

middleware.ensureLoggedIn = ensureLoggedIn.ensureLoggedIn(nconf.get('relative_path') + '/login');

middleware.pageView = function(req, res, next) {
	analytics.pageView({
		ip: req.ip,
		path: req.path,
		uid: req.hasOwnProperty('user') && req.user.hasOwnProperty('uid') ? parseInt(req.user.uid, 10) : 0
	});

	plugins.fireHook('action:middleware.pageView', {req: req});

	if (req.user) {
		user.updateLastOnlineTime(req.user.uid);
		if (req.path.startsWith('/api/users') || req.path.startsWith('/users')) {
			user.updateOnlineUsers(req.user.uid, next);
		} else {
			user.updateOnlineUsers(req.user.uid);
			next();
		}
	} else {
		next();
	}
};

middleware.addHeaders = function (req, res, next) {
	var defaults = {
		'X-Powered-By': 'NodeBB',
		'X-Frame-Options': 'SAMEORIGIN',
		'Access-Control-Allow-Origin': 'null'	// yes, string null.
	};
	var headers = {
		'X-Powered-By': meta.config['powered-by'],
		'X-Frame-Options': meta.config['allow-from-uri'] ? 'ALLOW-FROM ' + meta.config['allow-from-uri'] : undefined,
		'Access-Control-Allow-Origin': meta.config['access-control-allow-origin'],
		'Access-Control-Allow-Methods': meta.config['access-control-allow-methods'],
		'Access-Control-Allow-Headers': meta.config['access-control-allow-headers']
	};

	_.defaults(headers, defaults);
	headers = _.pick(headers, Boolean);		// Remove falsy headers

	for(var key in headers) {
		if (headers.hasOwnProperty(key)) {
			res.setHeader(key, headers[key]);
		}
	}

	next();
};

middleware.pluginHooks = function(req, res, next) {
	async.each(plugins.loadedHooks['filter:router.page'] || [], function(hookObj, next) {
		hookObj.method(req, res, next);
	}, function() {
		// If it got here, then none of the subscribed hooks did anything, or there were no hooks
		next();
	});
};

middleware.redirectToAccountIfLoggedIn = function(req, res, next) {
	if (req.session.forceLogin) {
		return next();
	}

	if (!req.user) {
		return next();
	}
	user.getUserField(req.user.uid, 'userslug', function (err, userslug) {
		if (err) {
			return next(err);
		}
		controllers.helpers.redirect(res, '/user/' + userslug);
	});
};

middleware.validateFiles = function(req, res, next) {
	if (!Array.isArray(req.files.files) || !req.files.files.length) {
		return next(new Error(['[[error:invalid-files]]']));
	}

	next();
};

middleware.prepareAPI = function(req, res, next) {
	res.locals.isAPI = true;
	next();
};

middleware.checkGlobalPrivacySettings = function(req, res, next) {
	if (!req.user && !!parseInt(meta.config.privateUserInfo, 10)) {
		return controllers.helpers.notAllowed(req, res);
	}

	next();
};

middleware.checkAccountPermissions = function(req, res, next) {
	// This middleware ensures that only the requested user and admins can pass
	async.waterfall([
		function (next) {
			middleware.authenticate(req, res, next);
		},
		function (next) {
			user.getUidByUserslug(req.params.userslug, next);
		},
		function (uid, next) {
			if (parseInt(uid, 10) === req.uid) {
				return next(null, true);
			}

			user.isAdminOrGlobalMod(req.uid, next);
		}
	], function (err, allowed) {
		if (err || allowed) {
			return next(err);
		}
		controllers.helpers.notAllowed(req, res);
	});
};

middleware.redirectUidToUserslug = function(req, res, next) {
	var uid = parseInt(req.params.uid, 10);
	if (!uid) {
		return next();
	}
	user.getUserField(uid, 'userslug', function(err, userslug) {
		if (err || !userslug) {
			return next(err);
		}

		var path = req.path.replace(/^\/api/, '')
				.replace('uid', 'user')
				.replace(uid, function() { return userslug; });
		controllers.helpers.redirect(res, path);
	});
};

middleware.isAdmin = function(req, res, next) {
	if (!req.uid) {
		return controllers.helpers.notAllowed(req, res);
	}

	user.isAdministrator(req.uid, function (err, isAdmin) {
		if (err) {
			return next(err);
		}

		if (isAdmin) {
			user.hasPassword(req.uid, function(err, hasPassword) {
				if (err) {
					return next(err);
				}

				if (!hasPassword) {
					return next();
				}

				var loginTime = req.session.meta ? req.session.meta.datetime : 0;
				if (loginTime && parseInt(loginTime, 10) > Date.now() - 3600000) {
					return next();
				}

				req.session.returnTo = req.path.replace(/^\/api/, '');
				req.session.forceLogin = 1;
				if (res.locals.isAPI) {
					res.status(401).json({});
				} else {
					res.redirect(nconf.get('relative_path') + '/login');
				}
			});
			return;
		}

		if (res.locals.isAPI) {
			return controllers.helpers.notAllowed(req, res);
		}

		middleware.buildHeader(req, res, function() {
			controllers.helpers.notAllowed(req, res);
		});
	});
};

middleware.routeTouchIcon = function(req, res) {
	if (meta.config['brand:touchIcon'] && validator.isURL(meta.config['brand:touchIcon'])) {
		return res.redirect(meta.config['brand:touchIcon']);
	} else {
		return res.sendFile(path.join(__dirname, '../../public', meta.config['brand:touchIcon'] || '/logo.png'), {
			maxAge: app.enabled('cache') ? 5184000000 : 0
		});
	}
};

middleware.addExpiresHeaders = function(req, res, next) {
	if (app.enabled('cache')) {
		res.setHeader("Cache-Control", "public, max-age=5184000");
		res.setHeader("Expires", new Date(Date.now() + 5184000000).toUTCString());
	} else {
		res.setHeader("Cache-Control", "public, max-age=0");
		res.setHeader("Expires", new Date().toUTCString());
	}

	next();
};

middleware.privateTagListing = function(req, res, next) {
	if (!req.user && parseInt(meta.config.privateTagListing, 10) === 1) {
		controllers.helpers.notAllowed(req, res);
	} else {
		next();
	}
};

middleware.exposeGroupName = function(req, res, next) {
	expose('groupName', groups.getGroupNameByGroupSlug, 'slug', req, res, next);
};

middleware.exposeUid = function(req, res, next) {
	expose('uid', user.getUidByUserslug, 'userslug', req, res, next);
};

function expose(exposedField, method, field, req, res, next) {
	if (!req.params.hasOwnProperty(field)) {
		return next();
	}
	method(req.params[field], function(err, id) {
		if (err) {
			return next(err);
		}

		res.locals[exposedField] = id;
		next();
	});
}

middleware.requireUser = function(req, res, next) {
	if (req.user) {
		return next();
	}

	res.status(403).render('403', {title: '[[global:403.title]]'});
};

middleware.privateUploads = function(req, res, next) {
	if (req.user || parseInt(meta.config.privateUploads, 10) !== 1) {
		return next();
	}
	if (req.path.startsWith('/uploads/files')) {
		return res.status(403).json('not-allowed');
	}
	next();
};

middleware.busyCheck = function(req, res, next) {
	if (global.env === 'production' && (!meta.config.hasOwnProperty('eventLoopCheckEnabled') || parseInt(meta.config.eventLoopCheckEnabled, 10) === 1) && toobusy()) {
		analytics.increment('errors:503');
		res.status(503).type('text/html').sendFile(path.join(__dirname, '../../public/503.html'));
	} else {
		next();
	}
};

middleware.applyBlacklist = function(req, res, next) {
	meta.blacklist.test(req.ip, function(err) {
		next(err);
	});
};

middleware.processLanguages = function(req, res, next) {
	var code = req.params.code;
	var key = req.path.match(/[\w]+\.json/);

	if (code && key) {
		languages.get(code, key[0], function(err, language) {
			res.status(200).json(language);
		});
	} else {
		res.status(404).json('{}');
	}
};

middleware.processTimeagoLocales = function(req, res, next) {
	var fallback = req.path.indexOf('-short') === -1 ? 'jquery.timeago.en.js' : 'jquery.timeago.en-short.js',
		localPath = path.join(__dirname, '../../public/vendor/jquery/timeago/locales', req.path),
		exists;

	try {
		exists = fs.accessSync(localPath, fs.F_OK | fs.R_OK);
	} catch(e) {
		exists = false;
	}

	if (exists) {
		res.status(200).sendFile(localPath, {
			maxAge: app.enabled('cache') ? 5184000000 : 0
		});
	} else {
		res.status(200).sendFile(path.join(__dirname, '../../public/vendor/jquery/timeago/locales', fallback), {
			maxAge: app.enabled('cache') ? 5184000000 : 0
		});
	}
};

middleware.registrationComplete = function(req, res, next) {
	// If the user's session contains registration data, redirect the user to complete registration
	if (!req.session.hasOwnProperty('registration')) {
		return next();
	} else {
		if (!req.path.endsWith('/register/complete')) {
			controllers.helpers.redirect(res, '/register/complete');
		} else {
			return next();
		}
	}
};

module.exports = function(webserver) {
	app = webserver;
	middleware.admin = require('./admin')(webserver);

	require('./header')(app, middleware);
	require('./render')(middleware);
	require('./maintenance')(middleware);

	return middleware;
};
