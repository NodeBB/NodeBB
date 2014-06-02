"use strict";

var templates = require('./../../public/src/templates'),
	utils = require('./../../public/src/utils'),
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

	relativePath,
	viewsPath,
	themesPath,
	baseTemplatesPath,
	themeTemplatesPath;


var middleware = {};

function routeThemeScreenshots(app, themes) {
	var	screenshotPath;

	async.each(themes, function(themeObj, next) {
		if (themeObj.screenshot) {
			screenshotPath = path.join(themesPath, themeObj.id, themeObj.screenshot);
			(function(id, path) {
				fs.exists(path, function(exists) {
					if (exists) {
						app.get('/css/previews/' + id, function(req, res) {
							res.sendfile(path);
						});
					}
				});
			})(themeObj.id, screenshotPath);
		} else {
			next(false);
		}
	});
}

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

	// Theme's templates path
	nconf.set('theme_templates_path', themeObj.templates ? path.join(themesPath, themeObj.id, themeObj.templates) : nconf.get('base_templates_path'));
	themeTemplatesPath = nconf.get('theme_templates_path');
}

function compileTemplates(pluginTemplates) {
	var mkdirp = require('mkdirp'),
		rimraf = require('rimraf');

	winston.info('[themes] Compiling templates');
	rimraf.sync(viewsPath);
	mkdirp.sync(viewsPath);

	async.parallel({
		baseTpls: function(next) {
			utils.walk(baseTemplatesPath, next);
		},
		themeTpls: function(next) {
			utils.walk(themeTemplatesPath, next);
		}
	}, function(err, data) {
		var baseTpls = data.baseTpls,
			themeTpls = data.themeTpls,
			paths = {};

		if (!baseTpls || !themeTpls) {
			winston.warn('[themes] Could not find base template files at: ' + baseTemplatesPath);
		}

		baseTpls = !baseTpls ? [] : baseTpls.map(function(tpl) { return tpl.replace(baseTemplatesPath, ''); });
		themeTpls = !themeTpls ? [] : themeTpls.map(function(tpl) { return tpl.replace(themeTemplatesPath, ''); });

		baseTpls.forEach(function(el, i) {
			paths[baseTpls[i]] = path.join(baseTemplatesPath, baseTpls[i]);
		});

		themeTpls.forEach(function(el, i) {
			paths[themeTpls[i]] = path.join(themeTemplatesPath, themeTpls[i]);
		});

		for (var tpl in pluginTemplates) {
			if (pluginTemplates.hasOwnProperty(tpl)) {
				paths[tpl] = pluginTemplates[tpl];
			}
		}

		async.each(Object.keys(paths), function(relativePath, next) {
			var file = fs.readFileSync(paths[relativePath]).toString(),
				matches = null,
				regex = /[ \t]*<!-- IMPORT ([\s\S]*?)? -->[ \t]*/;

			while(matches = file.match(regex)) {
				var partial = "/" + matches[1];

				if (paths[partial] && relativePath !== partial) {
					file = file.replace(regex, fs.readFileSync(paths[partial]).toString());
				} else {
					winston.warn('[themes] Partial not loaded: ' + matches[1]);
					file = file.replace(regex, "");
				}
			}

			mkdirp.sync(path.join(viewsPath, relativePath.split('/').slice(0, -1).join('/')));
			fs.writeFile(path.join(viewsPath, relativePath), file, next);
		}, function(err) {
			if (err) {
				winston.error(err);
			} else {
				winston.info('[themes] Successfully compiled templates.');
				emitter.emit('templates:compiled');
			}
		});
	});
}

function handleErrors(err, req, res, next) {
	// we may use properties of the error object
	// here and next(err) appropriately, or if
	// we possibly recovered from the error, simply next().
	console.error(err.stack);
	var status = err.status || 500;
	res.status(status);

	res.json(status, {
		error: err.message
	});
}

function catch404(req, res, next) {
	var	isLanguage = new RegExp('^' + relativePath + '/language/[\\w]{2,}/.*.json'),
		isClientScript = new RegExp('^' + relativePath + '\\/src\\/forum(\\/admin)?\\/.+\\.js');

	res.status(404);

	if (isClientScript.test(req.url)) {
		res.type('text/javascript').send(200, '');
	} else if (isLanguage.test(req.url)) {
		res.json(200, {});
	} else if (req.accepts('html')) {
		if (process.env.NODE_ENV === 'development') {
			winston.warn('Route requested but not found: ' + req.url);
		}

		res.redirect(relativePath + '/404');
	} else if (req.accepts('json')) {
		if (process.env.NODE_ENV === 'development') {
			winston.warn('Route requested but not found: ' + req.url);
		}

		res.json({
			error: 'Not found'
		});
	} else {
		res.type('txt').send('Not found');
	}
}




module.exports = function(app, data) {
	middleware = require('./middleware')(app);

	relativePath = nconf.get('relative_path');
	viewsPath = nconf.get('views_dir');
	themesPath = nconf.get('themes_path');
	baseTemplatesPath = nconf.get('base_templates_path');

	app.configure(function() {
		app.engine('tpl', templates.__express);
		app.set('view engine', 'tpl');
		app.set('views', viewsPath);

		app.enable('view cache');

		app.use(express.compress());

		app.use(express.favicon(path.join(__dirname, '../../', 'public', meta.config['brand:favicon'] ? meta.config['brand:favicon'] : 'favicon.ico')));
		app.use(relativePath + '/apple-touch-icon', middleware.routeTouchIcon);

		app.use(express.bodyParser());
		app.use(express.cookieParser());

		app.use(express.session({
			store: db.sessionStore,
			secret: nconf.get('secret'),
			key: 'express.sid',
			cookie: {
				maxAge: 1000 * 60 * 60 * 24 * parseInt(meta.configs.loginDays || 14, 10)
			}
		}));

		app.use(express.csrf()); // todo, make this a conditional middleware

		app.use(function (req, res, next) {
			res.locals.csrf_token = req.session._csrf;
			res.setHeader('X-Powered-By', 'NodeBB');

			res.setHeader('X-Frame-Options', 'SAMEORIGIN');
			if (meta.config['allow-from-uri']) {
				res.setHeader('ALLOW-FROM', meta.config['allow-from-uri']);
			}

			next();
		});

		app.use(middleware.processRender);

		auth.initialize(app);

		routeCurrentTheme(app, data.currentThemeId, data.themesData);
		routeThemeScreenshots(app, data.themesData);

		plugins.getTemplates(function(err, pluginTemplates) {
			compileTemplates(pluginTemplates);
		});

		app.use(relativePath, app.router);

		app.use(relativePath, express.static(path.join(__dirname, '../../', 'public'), {
			maxAge: app.enabled('cache') ? 5184000000 : 0
		}));

		app.use(catch404);
		app.use(handleErrors);
	});

	return middleware;
};
