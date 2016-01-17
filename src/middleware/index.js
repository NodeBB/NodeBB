"use strict";

var meta = require('../meta'),
	db = require('../database'),
	file = require('../file'),
	auth = require('../routes/authentication'),

	path = require('path'),
	nconf = require('nconf'),
	flash = require('connect-flash'),
	templates = require('templates.js'),
	bodyParser = require('body-parser'),
	cookieParser = require('cookie-parser'),
	compression = require('compression'),
	favicon = require('serve-favicon'),
	session = require('express-session'),
	useragent = require('express-useragent');


var middleware = {};

function setupFavicon(app) {
	var faviconPath = path.join(__dirname, '../../', 'public', meta.config['brand:favicon'] ? meta.config['brand:favicon'] : 'favicon.ico');
	if (file.existsSync(faviconPath)) {
		app.use(nconf.get('relative_path'), favicon(faviconPath));
	}
}

module.exports = function(app) {
	var relativePath = nconf.get('relative_path');

	middleware = require('./middleware')(app);

	app.engine('tpl', templates.__express);
	app.set('view engine', 'tpl');
	app.set('views', nconf.get('views_dir'));
	app.set('json spaces', process.env.NODE_ENV === 'development' ? 4 : 0);
	app.use(flash());

	app.enable('view cache');

	app.use(compression());

	setupFavicon(app);

	app.use(relativePath + '/apple-touch-icon', middleware.routeTouchIcon);

	app.use(bodyParser.urlencoded({extended: true}));
	app.use(bodyParser.json());
	app.use(cookieParser());
	app.use(useragent.express());

	var cookie = {
		maxAge: 1000 * 60 * 60 * 24 * (parseInt(meta.config.loginDays, 10) || 14)
	};

	if (meta.config.cookieDomain) {
		cookie.domain = meta.config.cookieDomain;
	}

	if (nconf.get('secure')) {
		cookie.secure = true;
	}

	app.use(session({
		store: db.sessionStore,
		secret: nconf.get('secret'),
		key: 'express.sid',
		cookie: cookie,
		resave: true,
		saveUninitialized: true
	}));

	app.use(middleware.addHeaders);
	app.use(middleware.processRender);
	auth.initialize(app, middleware);

	return middleware;
};
