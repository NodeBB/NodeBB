'use strict';

const async = require('async');
const path = require('path');
const validator = require('validator');
const nconf = require('nconf');
const toobusy = require('toobusy-js');
const util = require('util');
const multipart = require('connect-multiparty');
const { csrfSynchronisedProtection } = require('./csrf');

const plugins = require('../plugins');
const meta = require('../meta');
const user = require('../user');
const groups = require('../groups');
const analytics = require('../analytics');
const privileges = require('../privileges');
const cacheCreate = require('../cache/lru');
const helpers = require('./helpers');
const api = require('../api');

const controllers = {
	api: require('../controllers/api'),
	helpers: require('../controllers/helpers'),
};

const delayCache = cacheCreate({
	ttl: 1000 * 60,
	max: 200,
});
const multipartMiddleware = multipart();

const middleware = module.exports;

const relative_path = nconf.get('relative_path');

middleware.regexes = {
	timestampedUpload: /^\d+-.+$/,
};

const csrfMiddleware = csrfSynchronisedProtection;

middleware.applyCSRF = function (req, res, next) {
	if (req.uid >= 0) {
		csrfMiddleware(req, res, next);
	} else {
		next();
	}
};
middleware.applyCSRFasync = util.promisify(middleware.applyCSRF);

middleware.ensureLoggedIn = (req, res, next) => {
	if (!req.loggedIn) {
		return controllers.helpers.notAllowed(req, res);
	}

	setImmediate(next);
};

Object.assign(middleware, {
	admin: require('./admin'),
	...require('./header'),
});
require('./render')(middleware);
require('./maintenance')(middleware);
require('./user')(middleware);
middleware.uploads = require('./uploads');
require('./headers')(middleware);
require('./expose')(middleware);
middleware.assert = require('./assert');

middleware.stripLeadingSlashes = function stripLeadingSlashes(req, res, next) {
	const target = req.originalUrl.replace(relative_path, '');
	if (target.startsWith('//')) {
		return res.redirect(relative_path + target.replace(/^\/+/, '/'));
	}
	next();
};

middleware.pageView = helpers.try(async (req, res, next) => {
	if (req.loggedIn) {
		await Promise.all([
			user.updateOnlineUsers(req.uid),
			user.updateLastOnlineTime(req.uid),
		]);
	}
	next();
	await analytics.pageView({ ip: req.ip, uid: req.uid });
	plugins.hooks.fire('action:middleware.pageView', { req: req });
});

middleware.pluginHooks = helpers.try(async (req, res, next) => {
	// TODO: Deprecate in v2.0
	await async.each(plugins.loadedHooks['filter:router.page'] || [], (hookObj, next) => {
		hookObj.method(req, res, next);
	});

	await plugins.hooks.fire('response:router.page', {
		req: req,
		res: res,
	});

	if (!res.headersSent) {
		next();
	}
});

middleware.validateFiles = function validateFiles(req, res, next) {
	if (!req.files.files) {
		return next(new Error(['[[error:invalid-files]]']));
	}

	if (Array.isArray(req.files.files) && req.files.files.length) {
		return next();
	}

	if (typeof req.files.files === 'object') {
		req.files.files = [req.files.files];
		return next();
	}

	return next(new Error(['[[error:invalid-files]]']));
};

middleware.prepareAPI = function prepareAPI(req, res, next) {
	res.locals.isAPI = true;
	next();
};

middleware.logApiUsage = async function logApiUsage(req, res, next) {
	if (req.headers.hasOwnProperty('authorization')) {
		const [, token] = req.headers.authorization.split(' ');
		await api.utils.tokens.log(token);
	}

	next();
};

middleware.routeTouchIcon = function routeTouchIcon(req, res) {
	if (meta.config['brand:touchIcon'] && validator.isURL(meta.config['brand:touchIcon'])) {
		return res.redirect(meta.config['brand:touchIcon']);
	}
	let iconPath = '';
	if (meta.config['brand:touchIcon']) {
		iconPath = path.join(nconf.get('upload_path'), meta.config['brand:touchIcon'].replace(/assets\/uploads/, ''));
	} else {
		iconPath = path.join(nconf.get('base_dir'), 'public/images/touch/512.png');
	}

	return res.sendFile(iconPath, {
		maxAge: req.app.enabled('cache') ? 5184000000 : 0,
	});
};

middleware.privateTagListing = helpers.try(async (req, res, next) => {
	const canView = await privileges.global.can('view:tags', req.uid);
	if (!canView) {
		return controllers.helpers.notAllowed(req, res);
	}
	next();
});

middleware.exposeGroupName = helpers.try(async (req, res, next) => {
	await expose('groupName', groups.getGroupNameByGroupSlug, 'slug', req, res, next);
});

middleware.exposeUid = helpers.try(async (req, res, next) => {
	await expose('uid', user.getUidByUserslug, 'userslug', req, res, next);
});

async function expose(exposedField, method, field, req, res, next) {
	if (!req.params.hasOwnProperty(field)) {
		return next();
	}
	const value = await method(String(req.params[field]).toLowerCase());
	if (!value) {
		next('route');
		return;
	}

	res.locals[exposedField] = value;
	next();
}

middleware.privateUploads = function privateUploads(req, res, next) {
	if (req.loggedIn || !meta.config.privateUploads) {
		return next();
	}

	if (req.path.startsWith(`${nconf.get('relative_path')}/assets/uploads/files`)) {
		const extensions = (meta.config.privateUploadsExtensions || '').split(',').filter(Boolean);
		let ext = path.extname(req.path);
		ext = ext ? ext.replace(/^\./, '') : ext;
		if (!extensions.length || extensions.includes(ext)) {
			return res.status(403).json('not-allowed');
		}
	}
	next();
};

middleware.busyCheck = function busyCheck(req, res, next) {
	if (global.env === 'production' && meta.config.eventLoopCheckEnabled && toobusy()) {
		analytics.increment('errors:503');
		res.status(503).type('text/html').sendFile(path.join(__dirname, '../../public/503.html'));
	} else {
		setImmediate(next);
	}
};

middleware.applyBlacklist = async function applyBlacklist(req, res, next) {
	try {
		await meta.blacklist.test(req.ip);
		next();
	} catch (err) {
		next(err);
	}
};

middleware.delayLoading = function delayLoading(req, res, next) {
	// Introduces an artificial delay during load so that brute force attacks are effectively mitigated

	// Add IP to cache so if too many requests are made, subsequent requests are blocked for a minute
	let timesSeen = delayCache.get(req.ip) || 0;
	if (timesSeen > 10) {
		return res.sendStatus(429);
	}
	delayCache.set(req.ip, timesSeen += 1);

	setTimeout(next, 1000);
};

middleware.buildSkinAsset = helpers.try(async (req, res, next) => {
	// If this middleware is reached, a skin was requested, so it is built on-demand
	const targetSkin = path.basename(req.originalUrl).split('.css')[0].replace(/-rtl$/, '');
	if (!targetSkin) {
		return next();
	}

	const skins = (await meta.css.getCustomSkins()).map(skin => skin.value);
	const found = skins.concat(meta.css.supportedSkins).find(skin => `client-${skin}` === targetSkin);
	if (!found) {
		return next();
	}

	await plugins.prepareForBuild(['client side styles']);
	const [ltr, rtl] = await meta.css.buildBundle(targetSkin, true);
	require('../meta/minifier').killAll();
	res.status(200).type('text/css').send(req.originalUrl.includes('-rtl') ? rtl : ltr);
});

middleware.addUploadHeaders = function addUploadHeaders(req, res, next) {
	// Trim uploaded files' timestamps when downloading + force download if html
	let basename = path.basename(req.path);
	const extname = path.extname(req.path);
	if (req.path.startsWith('/uploads/files/') && middleware.regexes.timestampedUpload.test(basename)) {
		basename = basename.slice(14);
		res.header('Content-Disposition', `${extname.startsWith('.htm') ? 'attachment' : 'inline'}; filename="${basename}"`);
	}

	next();
};

middleware.validateAuth = helpers.try(async (req, res, next) => {
	try {
		await plugins.hooks.fire('static:auth.validate', {
			user: res.locals.user,
			strategy: res.locals.strategy,
		});
		next();
	} catch (err) {
		const regenerateSession = util.promisify(cb => req.session.regenerate(cb));
		await regenerateSession();
		req.uid = 0;
		req.loggedIn = false;
		next(err);
	}
});

middleware.checkRequired = function (fields, req, res, next) {
	// Used in API calls to ensure that necessary parameters/data values are present
	const missing = fields.filter(field => !req.body.hasOwnProperty(field) && !req.query.hasOwnProperty(field));

	if (!missing.length) {
		return next();
	}

	controllers.helpers.formatApiResponse(400, res, new Error(`[[error:required-parameters-missing, ${missing.join(' ')}]]`));
};

middleware.handleMultipart = (req, res, next) => {
	// Applies multipart handler on applicable content-type
	const { 'content-type': contentType } = req.headers;

	if (contentType && !contentType.startsWith('multipart/form-data')) {
		return next();
	}

	multipartMiddleware(req, res, next);
};
