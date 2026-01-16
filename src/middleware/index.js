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

	let iconPath = '';
	if (brandTouchIcon) {
		const uploadPath = nconf.get('upload_path');
		iconPath = path.join(uploadPath, brandTouchIcon.replace(/assets\/uploads/, ''));
		if (!iconPath.startsWith(uploadPath)) {
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
	await expose('groupName', groups.getGroupNameByGroupSlug, 'slug', req, res, next);
});

middleware.exposeUid = helpers.try(async (req, res, next) => {
	await expose('uid', user.getUidByUserslug, 'userslug', req, res, next);
});

async function expose(exposedField, method, field, req, res, next) {
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
	const extname = path.extname(req.path).toLowerCase();
	const unsafeExtensions = [
		'.html', '.htm', '.xhtml', '.mht', '.mhtml', '.stm', '.shtm', '.shtml',
		'.svg', '.svgz',
		'.xml', '.xsl', '.xslt',
	];
	const isInlineSafe = !unsafeExtensions.includes(extname);
	const dispositionType = isInlineSafe ? 'inline' : 'attachment';
	if (req.path.startsWith('/uploads/files/')) {
		if (middleware.regexes.timestampedUpload.test(basename)) {
			basename = basename.slice(14);
		}
		res.header('Content-Disposition', `${dispositionType}; filename="${basename}"`);
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
	const missing = fields.filter(
		field => req.body && !req.body.hasOwnProperty(field) && !req.query.hasOwnProperty(field)
	);

	if (!missing.length) {
		return next();
	}

	controllers.helpers.formatApiResponse(400, res, new Error(`[[error:required-parameters-missing, ${missing.join(' ')}]]`));
};
