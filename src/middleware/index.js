var templates = require('./../../public/src/templates'),
	translator = require('./../../public/src/translator'),
	meta = require('./../meta'),
	db = require('./../database'),
	auth = require('./../routes/authentication'),
	async = require('async'),
	path = require('path'),
	fs = require('fs'),
	nconf = require('nconf'),
	express = require('express')
	winston = require('winston');


/*
* todo: move out into their own file(s)
*/
var middleware = {};

middleware.processRender = function(req, res, next) {
	// res.render post-processing, modified from here: https://gist.github.com/mrlannigan/5051687
	var render = res.render;
	res.render = function(template, options, fn) {
		var self = this,
			options = options || {},
			req = this.req,
			app = req.app,
			defaultFn = function(err, str){
				if (err) {
					return req.next(err);
				}

				self.send(str);
			};

		if ('function' == typeof options) {
			fn = options, options = {};
		}

		if ('function' != typeof fn) {
			fn = defaultFn;
		}

		render.call(self, template, options, function(err, str) {
			if (res.locals.header) {
				str = res.locals.header + str;
			}

			if (res.locals.footer) {
				str = str + res.locals.footer;
			}

			if (str) {
				translator.translate(str, function(translated) {
					fn(err, translated);
				});
			} else {
				fn(err, str);
			}
		});
	};

	next();
};

middleware.routeTouchIcon = function(req, res) {
	if (meta.config['brand:logo'] && validator.isURL(meta.config['brand:logo'])) {
		return res.redirect(meta.config['brand:logo']);
	} else {
		return res.sendfile(path.join(__dirname, '../../public', meta.config['brand:logo'] || nconf.get('relative_path') + '/logo.png'), {
			maxAge: app.enabled('cache') ? 5184000000 : 0
		});
	}
}

/*
* Helper functions
*/
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
	if (!themeData['theme:type'] || themeData['theme:type'] === 'local') {
		// Local theme
		if (process.env.NODE_ENV === 'development') {
			winston.info('[themes] Using theme ' + themeId);
		}

		// Theme's static directory
		if (themeData['theme:staticDir']) {
			app.use('/css/assets', express.static(path.join(nconf.get('themes_path'), themeData['theme:id'], themeData['theme:staticDir']), {
				maxAge: app.enabled('cache') ? 5184000000 : 0
			}));
			if (process.env.NODE_ENV === 'development') {
				winston.info('Static directory routed for theme: ' + themeData['theme:id']);
			}
		}

		if (themeData['theme:templates']) {
			app.use('/templates', express.static(path.join(nconf.get('themes_path'), themeData['theme:id'], themeData['theme:templates']), {
				maxAge: app.enabled('cache') ? 5184000000 : 0
			}));
			if (process.env.NODE_ENV === 'development') {
				winston.info('Custom templates directory routed for theme: ' + themeData['theme:id']);
			}
		}
	} else {
		// If not using a local theme (bootswatch, etc), drop back to vanilla
		if (process.env.NODE_ENV === 'development') {
			winston.info('[themes] Using theme ' + themeId);
		}

		app.use(require('less-middleware')({
			src: path.join(nconf.get('themes_path'), '/nodebb-theme-vanilla'),
			dest: path.join(__dirname, '../../public/css'),
			prefix: nconf.get('relative_path') + '/css',
			yuicompress: app.enabled('minification') ? true : false
		}));
	}
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
		isClientScript = new RegExp('^' + nconf.get('relative_path') + '\\/src\\/forum(\\/admin)?\\/[\\w]+\\.js');

	res.status(404);

	if (isClientScript.test(req.url)) {
		// Handle missing client-side scripts
		res.type('text/javascript').send(200, '');
	} else if (isLanguage.test(req.url)) {
		// Handle languages by sending an empty object
		res.json(200, {});
	} else if (req.accepts('html')) {
		// respond with html page
		if (process.env.NODE_ENV === 'development') {
			winston.warn('Route requested but not found: ' + req.url);
		}

		res.redirect(nconf.get('relative_path') + '/404');
	} else if (req.accepts('json')) {
		// respond with json
		if (process.env.NODE_ENV === 'development') {
			winston.warn('Route requested but not found: ' + req.url);
		}

		res.json({
			error: 'Not found'
		});
	} else {
		// default to plain-text. send()
		res.type('txt').send('Not found');
	}
}

module.exports = function(app, data) {
	// Middlewares
	app.configure(function() {
		app.engine('tpl', templates.__express);
		app.set('view engine', 'tpl');
		app.set('views', path.join(__dirname, '../../public/templates'));

		// Pre-router middlewares
		app.use(express.compress());

		app.use(express.favicon(path.join(__dirname, '../../', 'public', meta.config['brand:favicon'] ? meta.config['brand:favicon'] : 'favicon.ico')));
		app.use('/apple-touch-icon', middleware.routeTouchIcon);

		app.use(require('less-middleware')({
			src: path.join(__dirname, '../../', 'public'),
			prefix: nconf.get('relative_path'),
			yuicompress: app.enabled('minification') ? true : false
		}));

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

		// Local vars, other assorted setup
		app.use(function (req, res, next) {
			res.locals.csrf_token = req.session._csrf;

			// Disable framing
			res.setHeader('X-Frame-Options', 'SAMEORIGIN');
			next();
		});

		app.use(middleware.processRender);

		// Authentication Routes
		auth.initialize(app);

		routeCurrentTheme(app, data.currentThemeData);

		// Route paths to screenshots for installed themes
		routeThemeScreenshots(app, data.themesData);

		app.use(app.router);

		// Static directory /public
		app.use(nconf.get('relative_path'), express.static(path.join(__dirname, '../../', 'public'), {
			maxAge: app.enabled('cache') ? 5184000000 : 0
		}));

		app.use(catch404);
		app.use(handleErrors);
	});
};