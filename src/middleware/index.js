"use strict";

var utils = require('./../../public/src/utils'),
	meta = require('./../meta'),
	plugins = require('./../plugins'),
	db = require('./../database'),
	auth = require('./../routes/authentication'),
	emitter = require('./../emitter'),

	async = require('async'),
	path = require('path'),
	fs = require('fs'),
	nconf = require('nconf'),
	express = require('express'),
	winston = require('winston'),
	flash = require('connect-flash'),
	templates = require('templates.js'),
	bodyParser = require('body-parser'),
	cookieParser = require('cookie-parser'),
	compression = require('compression'),
	favicon = require('serve-favicon'),
	multipart = require('connect-multiparty'),
	session = require('express-session'),
	cluster = require('cluster'),

	relativePath,
	themesPath;


var middleware = {};

function routeCurrentTheme(app, themeId, themesData) {
	var themeId = (themeId || 'nodebb-theme-vanilla'),
		themeObj = (function(id) {
			return themesData.filter(function(themeObj) {
				return themeObj.id === id;
			})[0];
		})(themeId);

	// Detect if a theme has been selected, and handle appropriately
	if (process.env.NODE_ENV === 'development') {
		winston.info('[themes] Using theme ' + themeId);
	}

	meta.themes.setPath(themeObj);
}

module.exports = function(app, data) {
	middleware = require('./middleware')(app);

	relativePath = nconf.get('relative_path');
	themesPath = nconf.get('themes_path');

	app.engine('tpl', templates.__express);
	app.set('view engine', 'tpl');
	app.set('views', nconf.get('views_dir'));
	app.set('json spaces', process.env.NODE_ENV === 'development' ? 4 : 0);
	app.use(flash());

	app.enable('view cache');

	app.use(compression());

	app.use(favicon(path.join(__dirname, '../../', 'public', meta.config['brand:favicon'] ? meta.config['brand:favicon'] : 'favicon.ico')));
	app.use(relativePath + '/apple-touch-icon', middleware.routeTouchIcon);

	app.use(bodyParser.urlencoded({extended: true}));
	app.use(bodyParser.json());
	app.use(cookieParser());

	var cookie = {
		maxAge: 1000 * 60 * 60 * 24 * parseInt(meta.config.loginDays || 14, 10)
	};
	if(meta.config.cookieDomain) {
		cookie.domain = meta.config.cookieDomain;
	}

	app.use(session({
		store: db.sessionStore,
		secret: nconf.get('secret'),
		key: 'express.sid',
		cookie: cookie,
		resave: true,
		saveUninitialized: true
	}));

	app.use(multipart());

	app.use(function (req, res, next) {
		res.setHeader('X-Powered-By', 'NodeBB');

		res.setHeader('X-Frame-Options', 'SAMEORIGIN');
		if (meta.config['allow-from-uri']) {
			res.setHeader('ALLOW-FROM', meta.config['allow-from-uri']);
		}

		next();
	});

	app.use(middleware.processRender);

	auth.initialize(app, middleware);

	routeCurrentTheme(app, data.currentThemeId, data.themesData);
	meta.templates.compile();

	return middleware;
};
