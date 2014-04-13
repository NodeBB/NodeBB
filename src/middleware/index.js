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
	winston = require('winston');


var middleware = {};


function routeThemeScreenshots(app, themes) {
	var	screenshotPath;

	async.each(themes, function(themeObj, next) {
		if (themeObj.screenshot) {
			screenshotPath = path.join(nconf.get('themes_path'), themeObj.id, themeObj.screenshot);
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

function routeCurrentTheme(app, themeData) {
	var themeId = (themeData['theme:id'] || 'nodebb-theme-vanilla');

	// Detect if a theme has been selected, and handle appropriately
	if (process.env.NODE_ENV === 'development') {
		winston.info('[themes] Using theme ' + themeId);
	}

	// Theme's static directory
	if (themeData['theme:staticDir']) {
		app.use(nconf.get('relative_path') + '/css/assets', express.static(path.join(nconf.get('themes_path'), themeData['theme:id'], themeData['theme:staticDir']), {
			maxAge: app.enabled('cache') ? 5184000000 : 0
		}));
		if (process.env.NODE_ENV === 'development') {
			winston.info('Static directory routed for theme: ' + themeData['theme:id']);
		}
	}
}

function compileTemplates(pluginTemplates) {
	var mkdirp = require('mkdirp'),
		rimraf = require('rimraf');

	winston.info('[themes] Compiling templates');
	rimraf.sync(nconf.get('views_dir'));
	mkdirp.sync(nconf.get('views_dir'));

	utils.walk(nconf.get('base_templates_path'), function(err, baseTpls) {
		utils.walk(nconf.get('theme_templates_path'), function (err, themeTpls) {
			var paths = pluginTemplates;

			if (!baseTpls || !themeTpls) {
				winston.warn('[themes] Could not find base template files at: ' + nconf.get('base_templates_path'));
			}

			baseTpls = !baseTpls ? [] : baseTpls.map(function(tpl) { return tpl.replace(nconf.get('base_templates_path'), ''); });
			themeTpls = !themeTpls ? [] : themeTpls.map(function(tpl) { return tpl.replace(nconf.get('theme_templates_path'), ''); });

			baseTpls.forEach(function(el, i) {
				paths[baseTpls[i]] = path.join(nconf.get('base_templates_path'), baseTpls[i]);
			});

			themeTpls.forEach(function(el, i) {
				paths[themeTpls[i]] = path.join(nconf.get('theme_templates_path'), themeTpls[i]);
			});

			async.each(Object.keys(paths), function(relative_path, next) {
				var file = fs.readFileSync(paths[relative_path]).toString(),
					matches = null,
					regex = /[ \t]*<!-- IMPORT ([\s\S]*?)? -->[ \t]*/;

				while(matches = file.match(regex)) {
					var partial = "/" + matches[1];

					if (paths[partial] && relative_path !== partial) {
						file = file.replace(regex, fs.readFileSync(paths[partial]).toString());
					} else {
						winston.warn('[themes] Partial not loaded: ' + matches[1]);
						file = file.replace(regex, "");
					}
				}

				mkdirp.sync(path.join(nconf.get('views_dir'), relative_path.split('/').slice(0, -1).join('/')));
				fs.writeFile(path.join(nconf.get('views_dir'), relative_path), file, next);
			}, function(err) {
				if (err) {
					winston.error(err);
				} else {
					winston.info('[themes] Successfully compiled templates.');
					emitter.emit('templates:compiled');
				}
			});
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
	var	isLanguage = new RegExp('^' + nconf.get('relative_path') + '/language/[\\w]{2,}/.*.json'),
		isClientScript = new RegExp('^' + nconf.get('relative_path') + '\\/src\\/forum(\\/admin)?\\/.+\\.js');

	res.status(404);

	if (isClientScript.test(req.url)) {
		res.type('text/javascript').send(200, '');
	} else if (isLanguage.test(req.url)) {
		res.json(200, {});
	} else if (req.accepts('html')) {
		if (process.env.NODE_ENV === 'development') {
			winston.warn('Route requested but not found: ' + req.url);
		}

		res.redirect(nconf.get('relative_path') + '/404');
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

	app.configure(function() {
		app.engine('tpl', templates.__express);
		app.set('view engine', 'tpl');
		app.set('views', nconf.get('views_dir'));

		app.use(express.compress());

		app.use(express.favicon(path.join(__dirname, '../../', 'public', meta.config['brand:favicon'] ? meta.config['brand:favicon'] : 'favicon.ico')));
		app.use(nconf.get('relative_path') + '/apple-touch-icon', middleware.routeTouchIcon);

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
			res.setHeader('X-Frame-Options', 'SAMEORIGIN');
			res.setHeader('X-Powered-By', 'NodeBB');
			next();
		});

		app.use(middleware.processRender);

		auth.initialize(app);

		routeCurrentTheme(app, data.currentThemeData);
		routeThemeScreenshots(app, data.themesData);

		plugins.getTemplates(function(err, pluginTemplates) {
			compileTemplates(pluginTemplates);
		});

		app.use(nconf.get('relative_path'), app.router);

		app.use(nconf.get('relative_path'), express.static(path.join(__dirname, '../../', 'public'), {
			maxAge: app.enabled('cache') ? 5184000000 : 0
		}));

		app.use(catch404);
		app.use(handleErrors);
	});

	return middleware;
};
