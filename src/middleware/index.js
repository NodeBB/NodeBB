'use strict';

const path = require('path');
const validator = require('validator');
const nconf = require('nconf');
const toobusy = require('toobusy-js');
const util = require('util');
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
const file = require('../file');

const controllers = {
	api: require('../controllers/api'),
	helpers: require('../controllers/helpers'),
};

const delayCache = cacheCreate({
	name: 'delay-middleware',
	ttl: 1000 * 60,
	max: 200,
});


const middleware = module.exports;

const relative_path = nconf.get('relative_path');

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
middleware.activitypub = require('./activitypub');

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
	await plugins.hooks.fire('response:router.page', {
		req: req,
		res: res,
	});

	if (!res.headersSent) {
		next();
	}
});

middleware.validateFiles = function validateFiles(req, res, next) {
	if (!req.files) {
		return next(new Error(['[[error:invalid-files]]']));
	}
	function makeFilesCompatible(files) {
		if (Array.isArray(files)) {
			// multer uses originalname and mimetype, but we use name and type
			files.forEach((file) => {
				if (file.originalname) {
					file.name = file.originalname;
				}
				if (file.mimetype) {
					file.type = file.mimetype;
				}
			});
		}
		next();
	}
	if (Array.isArray(req.files) && req.files.length) {
		return makeFilesCompatible(req.files);
	}

	if (typeof req.files === 'object') {
		req.files = [req.files];
		return makeFilesCompatible(req.files);
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
	const brandTouchIcon = meta.config['brand:touchIcon'];
	if (brandTouchIcon && validator.isURL(brandTouchIcon)) {
		return res.redirect(brandTouchIcon);
	}

	let iconPath;
	if (brandTouchIcon) {
		const uploadPath = nconf.get('upload_path');
		// brand:touchIcon is stored as a public url path, e.g. /assets/uploads/system/touchicon-orig.png
		const relativePath = path.normalize(brandTouchIcon)
			.replace(/^[/\\]+/, '')
			.replace(/^assets[/\\]uploads[/\\]?/, '');
		iconPath = path.join(uploadPath, relativePath);
		if (!file.isPathInside(uploadPath, iconPath)) {
			return res.status(404).send('Not found');
		}
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
	await expose('groupName', groups.getGroupNameByGroupSlug, middleware.canViewGroups, 'slug', req, res, next);
});

middleware.exposeUid = helpers.try(async (req, res, next) => {
	await expose('uid', user.getUidByUserslug, middleware.canViewUsers, 'userslug', req, res, next);
});

async function expose(exposedField, method, canViewMethod, field, req, res, next) {
	if (!req.params.hasOwnProperty(field)) {
		return next();
	}
	const param = String(req.params[field]).toLowerCase();

	// potential hostname — ActivityPub
	if (param.indexOf('@') !== -1) {
		res.locals[exposedField] = -2;
		return next();
	}

	const value = await method(param);
	if (!value) {
		canViewMethod(req, res, () => next('route'));
		return;
	}

	res.locals[exposedField] = value;
	next();
}

middleware.busyCheck = function busyCheck(req, res, next) {
	if (process.env.NODE_ENV === 'production' && meta.config.eventLoopCheckEnabled && toobusy()) {
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
	const timesSeen = delayCache.get(req.ip) || 0;
	if (timesSeen > 10) {
		return res.sendStatus(429);
	}
	delayCache.set(req.ip, timesSeen + 1);

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
	const body = req.body || {};
	const query = req.query || {};
	// Used in API calls to ensure that necessary parameters/data values are present
	const missing = fields.filter(
		field => !body.hasOwnProperty(field) && !query.hasOwnProperty(field)
	);

	if (!missing.length) {
		return next();
	}

	controllers.helpers.formatApiResponse(
		400,
		res,
		new Error(`[[error:required-parameters-missing, ${missing.join(' ')}]]`)
	);
};

middleware.requirePasswordAuth = helpers.try(async function (req, res, next) {
	const password = req.body?.password ?? req.headers['x-password-confirmation'];
	if (!password) {
		throw new Error('[[error:invalid-password]]');
	}

	const validPassword = await user.isPasswordCorrect(req.uid, password, req.ip);
	if (!validPassword) {
		throw new Error('[[error:invalid-password]]');
	}
	if (req.session?.meta) {
		req.session.meta.reAuthAt = Date.now();
	}
	next();
});

// handles both cold load(/foo/baz) and ajaxify(/api/foo/baz) for regular routes
// cold load /foo/baz => returnTo /foo/baz
// ajaxify /api/foo/baz => returnTo /foo/baz
middleware.requirePageReAuth = function ({ reauthWindowMinutes = 2 } = {}) {
	async function redirect(req, res) {
		if (res.locals.isAPI) {
			req.session.returnTo = req.url.replace(/^\/api/, '');
			await controllers.helpers.formatApiResponse(401, res);
		} else {
			req.session.returnTo = req.url;
			const isAdminPath = req.path === '/admin' || req.path.startsWith('/admin/');
			res.redirect(`${relative_path}/login${isAdminPath ? '?local=1' : ''}`);
		}
	}
	return helpers.try(async (req, res, next) => {
		if (!req.loggedIn) {
			return await redirect(req, res);
		}

		if (isReAuthValid(req, reauthWindowMinutes)) {
			return next();
		}

		if (await triggerReLoginHook(req, res)) {
			return;
		}

		await redirect(req, res);
	});
};

// handles /api/v3 routes only
// POST /api/v3/admin/tokens => returnTo whatever page the user was on via x-return-to
// DIRECT GET /api/v3/admin/groups => returnTo undefined
middleware.requireAPIReAuth = function ({ reauthWindowMinutes = 2 } = {}) {
	return helpers.try(async (req, res, next) => {
		if (!res.locals.isAPI) return next();
		if (!req.loggedIn) {
			return await controllers.helpers.formatApiResponse(401, res);
		}

		if (isReAuthValid(req, reauthWindowMinutes)) {
			return next();
		}

		req.session.returnTo = controllers.helpers.normalizeReturnToPath(
			req.headers['x-return-to'], { allowApi: false }
		) || '/';

		if (await triggerReLoginHook(req, res)) {
			return;
		}

		await controllers.helpers.formatApiResponse(401, res);
	});
};

function isReAuthValid(req, reauthWindowMinutes) {
	const reAuthAt = req.session.meta?.reAuthAt || 0;
	const reauthWindowMs = reauthWindowMinutes * 60 * 1000;
	return reAuthAt && (Date.now() - reAuthAt) <= reauthWindowMs;
}

async function triggerReLoginHook(req, res) {
	req.session.forceLogin = 1;
	await plugins.hooks.fire('response:auth.relogin', { req, res });
	return res.headersSent;
}
