"use strict";

var meta = require('../meta'),
	db = require('../database'),
	auth = require('../routes/authentication'),

	path = require('path'),
	fs = require('fs'),
	nconf = require('nconf'),
	winston = require('winston'),
	flash = require('connect-flash'),
	bodyParser = require('body-parser'),
	cookieParser = require('cookie-parser'),
	compression = require('compression'),
	favicon = require('serve-favicon'),
	session = require('express-session');


var middleware = {};

function setupFavicon(app) {
	var faviconPath = path.join(__dirname, '../../', 'public', meta.config['brand:favicon'] ? meta.config['brand:favicon'] : 'favicon.ico');
	if (fs.existsSync(faviconPath)) {
		app.use(favicon(faviconPath));
	}
}

module.exports = function(app) {
	var relativePath = nconf.get('relative_path');

	middleware = require('./middleware')(app);

	app.set('json spaces', process.env.NODE_ENV === 'development' ? 4 : 0);
	app.use(flash());
	app.use(compression());

	setupFavicon(app);

	app.use(relativePath + '/apple-touch-icon', middleware.routeTouchIcon);

	app.use(bodyParser.urlencoded({extended: true}));
	app.use(bodyParser.json());
	app.use(cookieParser());

	var cookie = {
		maxAge: 1000 * 60 * 60 * 24 * parseInt(meta.config.loginDays || 14, 10)
	};

	if (meta.config.cookieDomain) {
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

	app.use(function (req, res, next) {
		res.setHeader('X-Powered-By', 'NodeBB');

		if (meta.config['allow-from-uri']) {
			res.setHeader('X-Frame-Options', 'ALLOW-FROM ' + meta.config['allow-from-uri']);
		} else {
			res.setHeader('X-Frame-Options', 'SAMEORIGIN');
		}

		next();
	});

	app.use(middleware.processRender);
	auth.initialize(app, middleware);

	return middleware;
};
