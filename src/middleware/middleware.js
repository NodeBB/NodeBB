"use strict";

var app,
	middleware = {
		admin: {}
	},
	async = require('async'),
	path = require('path'),
	csrf = require('csurf'),

	validator = require('validator'),
	nconf = require('nconf'),
	ensureLoggedIn = require('connect-ensure-login'),
	toobusy = require('toobusy-js'),

	plugins = require('../plugins'),
	meta = require('../meta'),
	user = require('../user'),
	groups = require('../groups'),

	analytics = require('../analytics'),

	controllers = {
		api: require('./../controllers/api'),
		helpers: require('../controllers/helpers')
	};

toobusy.maxLag(parseInt(meta.config.eventLoopLagThreshold, 10) || 70);
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
	analytics.pageView(req.ip);

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

middleware.pluginHooks = function(req, res, next) {
	async.each(plugins.loadedHooks['filter:router.page'] || [], function(hookObj, next) {
		hookObj.method(req, res, next);
	}, function() {
		// If it got here, then none of the subscribed hooks did anything, or there were no hooks
		next();
	});
};

middleware.redirectToAccountIfLoggedIn = function(req, res, next) {
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

			user.isAdministrator(req.uid, next);
		}
	], function (err, allowed) {
		if (err || allowed) {
			return next(err);
		}
		controllers.helpers.notAllowed(req, res);
	});
};

middleware.isAdmin = function(req, res, next) {
	if (!req.uid) {
		return controllers.helpers.notAllowed(req, res);
	}

	user.isAdministrator(req.uid, function (err, isAdmin) {
		if (err || isAdmin) {
			return next(err);
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
	if (meta.config['brand:logo'] && validator.isURL(meta.config['brand:logo'])) {
		return res.redirect(meta.config['brand:logo']);
	} else {
		return res.sendFile(path.join(__dirname, '../../public', meta.config['brand:logo'] || '/logo.png'), {
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

	res.render('403', {title: '[[global:403.title]]'});
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
	if (toobusy()) {
		res.type('text/html').sendFile(path.join(__dirname, '../../public/503.html'));
	} else {
		next();
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
