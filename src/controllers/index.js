"use strict";

var async = require('async'),
	nconf = require('nconf'),
	validator = require('validator'),
	winston = require('winston'),

	meta = require('../meta'),
	user = require('../user'),
	posts = require('../posts'),
	topics = require('../topics'),
	plugins = require('../plugins'),
	sitemap = require('../sitemap'),
	categories = require('../categories'),
	privileges = require('../privileges'),
	helpers = require('./helpers');

var Controllers = {
	topics: require('./topics'),
	categories: require('./categories'),
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
	admin: require('./admin')
};


Controllers.home = function(req, res, next) {
	var route = meta.config.homePageRoute || meta.config.homePageCustom || 'categories';

	user.getSettings(req.uid, function(err, settings) {
		if (!err && settings.homePageRoute !== 'undefined' && settings.homePageRoute !== 'none') route = settings.homePageRoute || route;

		var hook = 'action:homepage.get:' + route;

		if (plugins.hasListeners(hook)) {
			plugins.fireHook(hook, {req: req, res: res, next: next});
		} else {
			if (route === 'categories' || route === '/') {
				Controllers.categories.list(req, res, next);
			} else if (route === 'recent') {
				Controllers.recent.get(req, res, next);
			} else if (route === 'popular') {
				Controllers.popular.get(req, res, next);
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
	var data = {},
		loginStrategies = require('../routes/authentication').getLoginStrategies(),
		registrationType = meta.config.registrationType || 'normal';

	data.alternate_logins = loginStrategies.length > 0;
	data.authentication = loginStrategies;
	data.allowLocalLogin = parseInt(meta.config.allowLocalLogin, 10) === 1 || parseInt(req.query.local, 10) === 1;
	data.allowRegistration = registrationType === 'normal' || registrationType === 'admin-approval';
	data.allowLoginWith = '[[login:' + (meta.config.allowLoginWith || 'username-email') + ']]';
	data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[global:login]]'}]);
	data.error = req.flash('error')[0];
	data.title = '[[pages:login]]';

	res.render('login', data);
};

Controllers.register = function(req, res, next) {
	var registrationType = meta.config.registrationType || 'normal';

	if (registrationType === 'disabled') {
		return next();
	}

	async.waterfall([
		function(next) {
			if (registrationType === 'invite-only') {
				user.verifyInvitation(req.query, next);
			} else {
				next();
			}
		},
		function(next) {
			plugins.fireHook('filter:parse.post', {postData: {content: meta.config.termsOfUse || ''}}, next);
		},
		function(tos, next) {
			var loginStrategies = require('../routes/authentication').getLoginStrategies();
			var data = {
				'register_window:spansize': loginStrategies.length ? 'col-md-6' : 'col-md-12',
				'alternate_logins': !!loginStrategies.length
			};

			data.authentication = loginStrategies;

			data.minimumUsernameLength = meta.config.minimumUsernameLength;
			data.maximumUsernameLength = meta.config.maximumUsernameLength;
			data.minimumPasswordLength = meta.config.minimumPasswordLength;
			data.termsOfUse = tos.postData.content;
			data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[register:register]]'}]);
			data.regFormEntry = [];
			data.error = req.flash('error')[0];
			data.title = '[[pages:register]]';

			plugins.fireHook('filter:register.build', {req: req, res: res, templateData: data}, next);
		}
	], function(err, data) {
		if (err) {
			return next(err);
		}
		res.render('register', data.templateData);
	});
};

Controllers.compose = function(req, res, next) {
	if (req.query.p && !res.locals.isAPI) {
		if (req.query.p.startsWith(nconf.get('relative_path'))) {
			req.query.p = req.query.p.replace(nconf.get('relative_path'), '');
		}
		return helpers.redirect(res, req.query.p);
	}

	res.render('', {});
};

Controllers.confirmEmail = function(req, res, next) {
	user.email.confirm(req.params.code, function (err) {
		res.render('confirm', {
			error: err ? err.message : ''
		});
	});
};

Controllers.sitemap = {};
Controllers.sitemap.render = function(req, res, next) {
	sitemap.render(function(err, tplData) {
		Controllers.render('sitemap', tplData, function(err, xml) {
			res.header('Content-Type', 'application/xml');
			res.send(xml);
		});
	})
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
		})
	}

	res.status(200).json(manifest);
};

Controllers.outgoing = function(req, res, next) {
	var url = req.query.url,
		data = {
			url: validator.escape(url),
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

module.exports = Controllers;
