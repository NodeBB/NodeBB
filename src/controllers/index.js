"use strict";

var async = require('async');
var nconf = require('nconf');
var validator = require('validator');
var winston = require('winston');

var meta = require('../meta');
var user = require('../user');
var plugins = require('../plugins');
var sitemap = require('../sitemap');
var helpers = require('./helpers');

var Controllers = {
	topics: require('./topics'),
	posts: require('./posts'),
	categories: require('./categories'),
	category: require('./category'),
	unread: require('./unread'),
	recent: require('./recent'),
	popular: require('./popular'),
	tags: require('./tags'),
	search: require('./search'),
	users: require('./users'),
	groups: require('./groups'),
	accounts: require('./accounts'),
	authentication: require('./authentication'),
	api: require('./api'),
	admin: require('./admin'),
	globalMods: require('./globalmods')
};


Controllers.home = function(req, res, next) {
	var route = meta.config.homePageRoute || (meta.config.homePageCustom || '').replace(/^\/+/, '') || 'categories';

	user.getSettings(req.uid, function(err, settings) {
		if (err) {
			return next(err);
		}
		if (parseInt(meta.config.allowUserHomePage, 10) === 1 && settings.homePageRoute !== 'undefined' && settings.homePageRoute !== 'none') {
			route = settings.homePageRoute || route;
		}

		var hook = 'action:homepage.get:' + route;

		if (plugins.hasListeners(hook)) {
			return plugins.fireHook(hook, {req: req, res: res, next: next});
		}

		if (route === 'categories' || route === '/') {
			Controllers.categories.list(req, res, next);
		} else if (route === 'unread') {
			Controllers.unread.get(req, res, next);
		} else if (route === 'recent') {
			Controllers.recent.get(req, res, next);
		} else if (route === 'popular') {
			Controllers.popular.get(req, res, next);
		} else {
			var match = /^category\/(\d+)\/(.*)$/.exec(route);

			if (match) {
				req.params.topic_index = "1";
				req.params.category_id = match[1];
				req.params.slug = match[2];
				Controllers.category.get(req, res, next);
			} else {
				res.redirect(route);
			}
		}
	});
};

Controllers.reset = function(req, res, next) {
	if (req.params.code) {
		user.reset.validate(req.params.code, function(err, valid) {
			if (err) {
				return next(err);
			}
			res.render('reset_code', {
				valid: valid,
				displayExpiryNotice: req.session.passwordExpired,
				code: req.params.code ? req.params.code : null,
				minimumPasswordLength: parseInt(meta.config.minimumPasswordLength, 10),
				breadcrumbs: helpers.buildBreadcrumbs([{text: '[[reset_password:reset_password]]', url: '/reset'}, {text: '[[reset_password:update_password]]'}]),
				title: '[[pages:reset]]'
			});

			delete req.session.passwordExpired;
		});
	} else {
		res.render('reset', {
			code: req.params.code ? req.params.code : null,
			breadcrumbs: helpers.buildBreadcrumbs([{text: '[[reset_password:reset_password]]'}]),
			title: '[[pages:reset]]'
		});
	}

};

Controllers.login = function(req, res, next) {
	var data = {};
	var loginStrategies = require('../routes/authentication').getLoginStrategies();
	var registrationType = meta.config.registrationType || 'normal';

	var allowLoginWith = (meta.config.allowLoginWith || 'username-email');

	var errorText;
	if (req.query.error === 'csrf-invalid') {
		errorText = '[[error:csrf-invalid]]';
	} else if (req.query.error) {
		errorText = req.query.error;
	}

	data.alternate_logins = loginStrategies.length > 0;
	data.authentication = loginStrategies;
	data.allowLocalLogin = parseInt(meta.config.allowLocalLogin, 10) === 1 || parseInt(req.query.local, 10) === 1;
	data.allowRegistration = registrationType === 'normal' || registrationType === 'admin-approval' || registrationType === 'admin-approval-ip';
	data.allowLoginWith = '[[login:' + allowLoginWith + ']]';
	data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[global:login]]'}]);
	data.error = req.flash('error')[0] || errorText;
	data.title = '[[pages:login]]';

	if (!data.allowLocalLogin && !data.allowRegistration && data.alternate_logins && data.authentication.length === 1) {
		if (res.locals.isAPI) {
			return helpers.redirect(res, {
				external: data.authentication[0].url
			});
		} else {
			return res.redirect(data.authentication[0].url);
		}
	}
	if (req.uid) {
		user.getUserFields(req.uid, ['username', 'email'], function(err, user) {
			if (err) {
				return next(err);
			}
			data.username = allowLoginWith === 'email' ? user.email : user.username;
			data.alternate_logins = [];
			res.render('login', data);
		});
	} else {
		res.render('login', data);
	}

};

Controllers.register = function(req, res, next) {
	var registrationType = meta.config.registrationType || 'normal';

	if (registrationType === 'disabled') {
		return next();
	}

	var errorText;
	if (req.query.error === 'csrf-invalid') {
		errorText = '[[error:csrf-invalid]]';
	}

	async.waterfall([
		function(next) {
			if (registrationType === 'invite-only' || registrationType === 'admin-invite-only') {
				user.verifyInvitation(req.query, next);
			} else {
				next();
			}
		},
		function(next) {
			plugins.fireHook('filter:parse.post', {postData: {content: meta.config.termsOfUse || ''}}, next);
		}
	], function(err, termsOfUse) {
		if (err) {
			return next(err);
		}
		var loginStrategies = require('../routes/authentication').getLoginStrategies();
		var data = {
			'register_window:spansize': loginStrategies.length ? 'col-md-6' : 'col-md-12',
			'alternate_logins': !!loginStrategies.length
		};

		data.authentication = loginStrategies;

		data.minimumUsernameLength = parseInt(meta.config.minimumUsernameLength, 10);
		data.maximumUsernameLength = parseInt(meta.config.maximumUsernameLength, 10);
		data.minimumPasswordLength = parseInt(meta.config.minimumPasswordLength, 10);
		data.termsOfUse = termsOfUse.postData.content;
		data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[register:register]]'}]);
		data.regFormEntry = [];
		data.error = req.flash('error')[0] || errorText;
		data.title = '[[pages:register]]';

		res.render('register', data);
	});
};

Controllers.registerInterstitial = function(req, res, next) {
	if (!req.session.hasOwnProperty('registration')) {
		return res.redirect(nconf.get('relative_path') + '/register');
	}

	plugins.fireHook('filter:register.interstitial', {
		userData: req.session.registration,
		interstitials: []
	}, function(err, data) {
		if (!data.interstitials.length) {
			return next();
		}

		var renders = data.interstitials.map(function(interstitial) {
			return async.apply(req.app.render.bind(req.app), interstitial.template, interstitial.data || {});
		});
		var errors = req.flash('error');

		async.parallel(renders, function(err, sections) {
			res.render('registerComplete', {
				errors: errors,
				sections: sections
			});
		});
	});
};

Controllers.compose = function(req, res, next) {
	plugins.fireHook('filter:composer.build', {
		req: req,
		res: res,
		next: next,
		templateData: {}
	}, function(err, data) {
		if (err) {
			return next(err);
		}

		if (data.templateData.disabled) {
			res.render('', {
				title: '[[modules:composer.compose]]'
			});
		} else {
			data.templateData.title = '[[modules:composer.compose]]';
			res.render('compose', data.templateData);
		}
	});
};

Controllers.confirmEmail = function(req, res) {
	user.email.confirm(req.params.code, function (err) {
		res.render('confirm', {
			error: err ? err.message : '',
			title: '[[pages:confirm]]',
		});
	});
};

Controllers.sitemap = {};
Controllers.sitemap.render = function(req, res, next) {
	sitemap.render(function(err, tplData) {
		if (err) {
			return next(err);
		}

		Controllers.render('sitemap', tplData, function(err, xml) {
			res.header('Content-Type', 'application/xml');
			res.send(xml);
		});
	});
};

Controllers.sitemap.getPages = function(req, res, next) {
	if (parseInt(meta.config['feeds:disableSitemap'], 10) === 1) {
		return next();
	}

	sitemap.getPages(function(err, xml) {
		if (err) {
			return next(err);
		}
		res.header('Content-Type', 'application/xml');
		res.send(xml);
	});
};

Controllers.sitemap.getCategories = function(req, res, next) {
	if (parseInt(meta.config['feeds:disableSitemap'], 10) === 1) {
		return next();
	}

	sitemap.getCategories(function(err, xml) {
		if (err) {
			return next(err);
		}
		res.header('Content-Type', 'application/xml');
		res.send(xml);
	});
};

Controllers.sitemap.getTopicPage = function(req, res, next) {
	if (parseInt(meta.config['feeds:disableSitemap'], 10) === 1) {
		return next();
	}

	sitemap.getTopicPage(parseInt(req.params[0], 10), function(err, xml) {
		if (err) {
			return next(err);
		} else if (!xml) {
			return next();
		}

		res.header('Content-Type', 'application/xml');
		res.send(xml);
	});
};

Controllers.robots = function (req, res) {
	res.set('Content-Type', 'text/plain');

	if (meta.config["robots.txt"]) {
		res.send(meta.config["robots.txt"]);
	} else {
		res.send("User-agent: *\n" +
			"Disallow: " + nconf.get('relative_path') + "/admin/\n" +
			"Sitemap: " + nconf.get('url') + "/sitemap.xml");
	}
};

Controllers.manifest = function(req, res) {
	var manifest = {
			name: meta.config.title || 'NodeBB',
			start_url: nconf.get('relative_path') + '/',
			display: 'standalone',
			orientation: 'portrait',
			icons: []
		};

	if (meta.config['brand:touchIcon']) {
		manifest.icons.push({
			src: nconf.get('relative_path') + '/uploads/system/touchicon-36.png',
			sizes: '36x36',
			type: 'image/png',
			density: 0.75
		}, {
			src: nconf.get('relative_path') + '/uploads/system/touchicon-48.png',
			sizes: '48x48',
			type: 'image/png',
			density: 1.0
		}, {
			src: nconf.get('relative_path') + '/uploads/system/touchicon-72.png',
			sizes: '72x72',
			type: 'image/png',
			density: 1.5
		}, {
			src: nconf.get('relative_path') + '/uploads/system/touchicon-96.png',
			sizes: '96x96',
			type: 'image/png',
			density: 2.0
		}, {
			src: nconf.get('relative_path') + '/uploads/system/touchicon-144.png',
			sizes: '144x144',
			type: 'image/png',
			density: 3.0
		}, {
			src: nconf.get('relative_path') + '/uploads/system/touchicon-192.png',
			sizes: '192x192',
			type: 'image/png',
			density: 4.0
		});
	}

	res.status(200).json(manifest);
};

Controllers.outgoing = function(req, res) {
	var url = req.query.url;
	var data = {
		url: validator.escape(String(url)),
		title: meta.config.title,
		breadcrumbs: helpers.buildBreadcrumbs([{text: '[[notifications:outgoing_link]]'}])
	};

	if (url) {
		res.render('outgoing', data);
	} else {
		res.status(404).redirect(nconf.get('relative_path') + '/404');
	}
};

Controllers.termsOfUse = function(req, res, next) {
	if (!meta.config.termsOfUse) {
		return next();
	}
	res.render('tos', {termsOfUse: meta.config.termsOfUse});
};

Controllers.handle404 = function(req, res) {
	var relativePath = nconf.get('relative_path');
	var isLanguage = new RegExp('^' + relativePath + '/language/.*/.*.json');
	var isClientScript = new RegExp('^' + relativePath + '\\/src\\/.+\\.js');

	if (plugins.hasListeners('action:meta.override404')) {
		return plugins.fireHook('action:meta.override404', {
			req: req,
			res: res,
			error: {}
		});
	}

	if (isClientScript.test(req.url)) {
		res.type('text/javascript').status(200).send('');
	} else if (isLanguage.test(req.url)) {
		res.status(200).json({});
	} else if (req.path.startsWith(relativePath + '/uploads') || (req.get('accept') && req.get('accept').indexOf('text/html') === -1) || req.path === '/favicon.ico') {
		meta.errors.log404(req.path || '');
		res.sendStatus(404);
	} else if (req.accepts('html')) {
		if (process.env.NODE_ENV === 'development') {
			winston.warn('Route requested but not found: ' + req.url);
		}

		meta.errors.log404(req.path.replace(/^\/api/, '') || '');
		res.status(404);

		var path = String(req.path || '');

		if (res.locals.isAPI) {
			return res.json({path: validator.escape(path.replace(/^\/api/, '')), title: '[[global:404.title]]'});
		}

		req.app.locals.middleware.buildHeader(req, res, function() {
			res.render('404', {path: validator.escape(path), title: '[[global:404.title]]'});
		});
	} else {
		res.status(404).type('txt').send('Not found');
	}
};

Controllers.handleErrors = function(err, req, res, next) {
	switch (err.code) {
		case 'EBADCSRFTOKEN':
			winston.error(req.path + '\n', err.message);
			return res.sendStatus(403);
		case 'blacklisted-ip':
			return res.status(403).type('text/plain').send(err.message);
	}

	if (parseInt(err.status, 10) === 302 && err.path) {
		return res.locals.isAPI ? res.status(302).json(err.path) : res.redirect(err.path);
	}

	winston.error(req.path + '\n', err.stack);

	res.status(err.status || 500);

	var path = String(req.path || '');
	if (res.locals.isAPI) {
		res.json({path: validator.escape(path), error: err.message});
	} else {
		req.app.locals.middleware.buildHeader(req, res, function() {
			res.render('500', {path: validator.escape(path), error: validator.escape(String(err.message))});
		});
	}
};

module.exports = Controllers;
