"use strict";

var async = require('async'),
	nconf = require('nconf'),
	validator = require('validator'),
	winston = require('winston'),

	auth = require('../routes/authentication'),
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
	tags: require('./tags'),
	search: require('./search'),
	users: require('./users'),
	groups: require('./groups'),
	accounts: require('./accounts'),
	static: require('./static'),
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
			Controllers.categories.recent(req, res, next);
		} else if (route === 'popular') {
			Controllers.categories.popular(req, res, next);
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
				breadcrumbs: helpers.buildBreadcrumbs([{text: '[[reset_password:reset_password]]', url: '/reset'}, {text: '[[reset_password:update_password]]'}])
			});

			delete req.session.passwordExpired;
		});
	} else {
		res.render('reset', {
			code: req.params.code ? req.params.code : null,
			breadcrumbs: helpers.buildBreadcrumbs([{text: '[[reset_password:reset_password]]'}])
		});
	}

};

Controllers.login = function(req, res, next) {
	var data = {},
		loginStrategies = auth.getLoginStrategies(),
		emailersPresent = plugins.hasListeners('action:email.send');

	data.alternate_logins = loginStrategies.length > 0;
	data.authentication = loginStrategies;
	data.showResetLink = emailersPresent;
	data.allowLocalLogin = parseInt(meta.config.allowLocalLogin, 10) === 1;
	data.allowRegistration = parseInt(meta.config.allowRegistration, 10) === 1;
	data.allowLoginWith = '[[login:' + (meta.config.allowLoginWith || 'username-email') + ']]';
	data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[global:login]]'}]);
	data.error = req.flash('error')[0];

	res.render('login', data);
};

Controllers.register = function(req, res, next) {
	if(meta.config.allowRegistration !== undefined && parseInt(meta.config.allowRegistration, 10) === 0) {
		return res.redirect(nconf.get('relative_path') + '/403');
	}

	var data = {},
		loginStrategies = auth.getLoginStrategies();

	if (loginStrategies.length === 0) {
		data = {
			'register_window:spansize': 'col-md-12',
			'alternate_logins': false
		};
	} else {
		data = {
			'register_window:spansize': 'col-md-6',
			'alternate_logins': true
		};
	}

	data.authentication = loginStrategies;

	data.minimumUsernameLength = meta.config.minimumUsernameLength;
	data.maximumUsernameLength = meta.config.maximumUsernameLength;
	data.minimumPasswordLength = meta.config.minimumPasswordLength;
	data.termsOfUse = meta.config.termsOfUse;
	data.breadcrumbs = helpers.buildBreadcrumbs([{text: '[[register:register]]'}]);
	data.regFormEntry = [];
	data.error = req.flash('error')[0];

	plugins.fireHook('filter:register.build', {req: req, res: res, templateData: data}, function(err, data) {
		if (err && global.env === 'development') {
			winston.warn(JSON.stringify(err));
			return next(err);
		}
		res.render('register', data.templateData);
	});
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
			url: url,
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
