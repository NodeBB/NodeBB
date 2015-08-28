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
	categories = require('../categories'),
	privileges = require('../privileges'),
	helpers = require('./helpers');

var Controllers = {
	posts: require('./posts'),
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
	var route = meta.config.homePageRoute || 'categories',
		hook = 'action:homepage.get:' + route;

	if (plugins.hasListeners(hook)) {
		plugins.fireHook(hook, {req: req, res: res, next: next});
	} else {
		if (route === 'categories') {
			Controllers.categories.list(req, res, next);
		} else if (route === 'recent') {
			Controllers.recent.get(req, res, next);
		} else if (route === 'popular') {
			Controllers.popular.get(req, res, next);
		} else {
			next();
		}
	}
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
		emailersPresent = plugins.hasListeners('action:email.send');

	var registrationType = meta.config.registrationType || 'normal';

	data.alternate_logins = loginStrategies.length > 0;
	data.authentication = loginStrategies;
	data.showResetLink = emailersPresent;
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
		return helpers.notFound(req, res);
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
			plugins.fireHook('filter:parse.post', {postData: {content: meta.config.termsOfUse}}, next);
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

Controllers.sitemap = function(req, res, next) {
	if (parseInt(meta.config['feeds:disableSitemap'], 10) === 1) {
		return helpers.notFound(req, res);
	}

	var sitemap = require('../sitemap.js');

	sitemap.render(function(xml) {
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
		return helpers.notFound(req, res);
	}
	res.render('tos', {termsOfUse: meta.config.termsOfUse});
};

module.exports = Controllers;
