'use strict';

var async = require('async');
var path = require('path');
var csrf = require('csurf');
var validator = require('validator');
var nconf = require('nconf');
var ensureLoggedIn = require('connect-ensure-login');
var toobusy = require('toobusy-js');
var LRU = require('lru-cache');

var plugins = require('../plugins');
var meta = require('../meta');
var user = require('../user');
var groups = require('../groups');
var file = require('../file');

var analytics = require('../analytics');

var controllers = {
	api: require('./../controllers/api'),
	helpers: require('../controllers/helpers'),
};

var delayCache = LRU({
	maxAge: 1000 * 60,
});

var middleware = module.exports;

middleware.regexes = {
	timestampedUpload: /^\d+-.+$/,
};

middleware.applyCSRF = csrf();

middleware.ensureLoggedIn = ensureLoggedIn.ensureLoggedIn(nconf.get('relative_path') + '/login');

require('./admin')(middleware);
require('./header')(middleware);
require('./render')(middleware);
require('./maintenance')(middleware);
require('./user')(middleware);
require('./headers')(middleware);

middleware.stripLeadingSlashes = function (req, res, next) {
	var target = req.originalUrl.replace(nconf.get('relative_path'), '');
	if (target.startsWith('//')) {
		res.redirect(nconf.get('relative_path') + target.replace(/^\/+/, '/'));
	} else {
		setImmediate(next);
	}
};

middleware.pageView = function (req, res, next) {
	analytics.pageView({
		ip: req.ip,
		uid: req.uid,
	});

	plugins.fireHook('action:middleware.pageView', { req: req });

	if (req.loggedIn) {
		user.updateLastOnlineTime(req.uid);
		if (req.path.startsWith('/api/users') || req.path.startsWith('/users')) {
			user.updateOnlineUsers(req.uid, next);
		} else {
			user.updateOnlineUsers(req.uid);
			setImmediate(next);
		}
	} else {
		setImmediate(next);
	}
};


middleware.pluginHooks = function (req, res, next) {
	async.each(plugins.loadedHooks['filter:router.page'] || [], function (hookObj, next) {
		hookObj.method(req, res, next);
	}, function (err) {
		// If it got here, then none of the subscribed hooks did anything, or there were no hooks
		next(err);
	});
};

middleware.validateFiles = function (req, res, next) {
	if (!Array.isArray(req.files.files) || !req.files.files.length) {
		return next(new Error(['[[error:invalid-files]]']));
	}

	next();
};

middleware.prepareAPI = function (req, res, next) {
	res.locals.isAPI = true;
	next();
};

middleware.routeTouchIcon = function (req, res) {
	if (meta.config['brand:touchIcon'] && validator.isURL(meta.config['brand:touchIcon'])) {
		return res.redirect(meta.config['brand:touchIcon']);
	}
	var iconPath = '';
	if (meta.config['brand:touchIcon']) {
		iconPath = path.join(nconf.get('upload_path'), meta.config['brand:touchIcon'].replace(/assets\/uploads/, ''));
	} else {
		iconPath = path.join(nconf.get('base_dir'), 'public/logo.png');
	}

	return res.sendFile(iconPath, {
		maxAge: req.app.enabled('cache') ? 5184000000 : 0,
	});
};

middleware.privateTagListing = function (req, res, next) {
	if (!req.loggedIn && meta.config.privateTagListing) {
		controllers.helpers.notAllowed(req, res);
	} else {
		next();
	}
};

middleware.exposeGroupName = function (req, res, next) {
	expose('groupName', groups.getGroupNameByGroupSlug, 'slug', req, res, next);
};

middleware.exposeUid = function (req, res, next) {
	expose('uid', user.getUidByUserslug, 'userslug', req, res, next);
};

function expose(exposedField, method, field, req, res, next) {
	if (!req.params.hasOwnProperty(field)) {
		return next();
	}
	async.waterfall([
		function (next) {
			method(req.params[field], next);
		},
		function (id, next) {
			res.locals[exposedField] = id;
			next();
		},
	], next);
}

middleware.privateUploads = function (req, res, next) {
	if (req.loggedIn || !meta.config.privateUploads) {
		return next();
	}

	if (req.path.startsWith(nconf.get('relative_path') + '/assets/uploads/files')) {
		var extensions = (meta.config.privateUploadsExtensions || '').split(',').filter(Boolean);
		var ext = path.extname(req.path);
		ext = ext ? ext.replace(/^\./, '') : ext;
		if (!extensions.length || extensions.includes(ext)) {
			return res.status(403).json('not-allowed');
		}
	}
	next();
};

middleware.busyCheck = function (req, res, next) {
	if (global.env === 'production' && meta.config.eventLoopCheckEnabled && toobusy()) {
		analytics.increment('errors:503');
		res.status(503).type('text/html').sendFile(path.join(__dirname, '../../public/503.html'));
	} else {
		setImmediate(next);
	}
};

middleware.applyBlacklist = function (req, res, next) {
	meta.blacklist.test(req.ip, function (err) {
		next(err);
	});
};

middleware.processTimeagoLocales = function (req, res, next) {
	var fallback = !req.path.includes('-short') ? 'jquery.timeago.en.js' : 'jquery.timeago.en-short.js';
	var localPath = path.join(__dirname, '../../public/vendor/jquery/timeago/locales', req.path);

	async.waterfall([
		function (next) {
			file.exists(localPath, next);
		},
		function (exists, next) {
			if (exists) {
				next(null, localPath);
			} else {
				next(null, path.join(__dirname, '../../public/vendor/jquery/timeago/locales', fallback));
			}
		},
		function (path) {
			res.status(200).sendFile(path, {
				maxAge: req.app.enabled('cache') ? 5184000000 : 0,
			});
		},
	], next);
};

middleware.delayLoading = function (req, res, next) {
	// Introduces an artificial delay during load so that brute force attacks are effectively mitigated

	// Add IP to cache so if too many requests are made, subsequent requests are blocked for a minute
	var timesSeen = delayCache.get(req.ip) || 0;
	if (timesSeen > 10) {
		return res.sendStatus(429);
	}
	delayCache.set(req.ip, timesSeen += 1);

	setTimeout(next, 1000);
};

middleware.buildSkinAsset = function (req, res, next) {
	// If this middleware is reached, a skin was requested, so it is built on-demand
	var target = path.basename(req.originalUrl).match(/(client-[a-z]+)/);
	if (target) {
		async.waterfall([
			async.apply(plugins.prepareForBuild, ['client side styles']),
			async.apply(meta.css.buildBundle, target[0], true),
		], function (err, css) {
			if (err) {
				return next();
			}

			require('../meta/minifier').killAll();
			res.status(200).type('text/css').send(css);
		});
	} else {
		setImmediate(next);
	}
};

middleware.trimUploadTimestamps = (req, res, next) => {
	// Check match
	let basename = path.basename(req.path);
	if (req.path.startsWith('/uploads/files/') && middleware.regexes.timestampedUpload.test(basename)) {
		basename = basename.slice(14);
		res.header('Content-Disposition', 'inline; filename="' + basename + '"');
	}

	return next();
};
