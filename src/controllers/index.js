"use strict";

var async = require('async');
var nconf = require('nconf');
var validator = require('validator');

var meta = require('../meta');
var user = require('../user');
var plugins = require('../plugins');
var sitemap = require('../sitemap');
var helpers = require('./helpers');

var Controllers = {
	topics: require('./topics'),
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

	if (!data.allowLocalLogin && !data.allowRegistration && data.alternate_logins && data.authentication.length === 1) {
		return helpers.redirect(res, {
			external: data.authentication[0].url
		});
	}

	res.render('login', data);
};

Controllers.register = function(req, res, next) {
	var registrationType = meta.config.registrationType || 'normal';

	if (registrationType === 'disabled') {
		return next();
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
		data.error = req.flash('error')[0];
		data.title = '[[pages:register]]';

		res.render('register', data);
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

Controllers.confirmEmail = function(req, res, next) {
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

Controllers.outgoing = function(req, res, next) {
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

module.exports = Controllers;
