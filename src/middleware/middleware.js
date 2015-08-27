"use strict";

var app,
	middleware = {
		admin: {}
	},
	async = require('async'),
	path = require('path'),
	csrf = require('csurf'),
	winston = require('winston'),
	validator = require('validator'),
	nconf = require('nconf'),
	ensureLoggedIn = require('connect-ensure-login'),

	plugins = require('../plugins'),
	navigation = require('../navigation'),
	meta = require('../meta'),
	translator = require('../../public/src/modules/translator'),
	user = require('../user'),
	groups = require('../groups'),
	db = require('../database'),
	categories = require('../categories'),
	topics = require('../topics'),
	messaging = require('../messaging'),

	analytics = require('../analytics'),

	controllers = {
		api: require('./../controllers/api'),
		helpers: require('../controllers/helpers')
	};

middleware.authenticate = function(req, res, next) {
	if (req.user) {
		return next();
	} else if (plugins.hasListeners('action:middleware.authenticate')) {
		return plugins.fireHook('action:middleware.authenticate', {
			req: req,
			res: res,
			next: next
		});
	}

	controllers.helpers.notAllowed(req, res);
};

middleware.applyCSRF = csrf();

middleware.ensureLoggedIn = ensureLoggedIn.ensureLoggedIn(nconf.get('relative_path') + '/login');

middleware.pageView = function(req, res, next) {
	analytics.pageView(req.ip);

	plugins.fireHook('action:middleware.pageView', {req: req});

	if (req.user) {
		user.updateLastOnlineTime(req.user.uid);
		if (req.path.startsWith('/api/users') || req.path.startsWith('/users')) {
			user.updateOnlineUsers(req.user.uid, next);
		} else {
			user.updateOnlineUsers(req.user.uid);
			next();
		}
	} else {
		next();
	}
};

middleware.pluginHooks = function(req, res, next) {
	async.each(plugins.loadedHooks['filter:router.page'] || [], function(hookObj, next) {
		hookObj.method(req, res, next);
	}, function(req, res) {
		// If it got here, then none of the subscribed hooks did anything, or there were no hooks
		next();
	});
};

middleware.redirectToAccountIfLoggedIn = function(req, res, next) {
	if (!req.user) {
		return next();
	}
	user.getUserField(req.user.uid, 'userslug', function (err, userslug) {
		if (err) {
			return next(err);
		}
		controllers.helpers.redirect(res, '/user/' + userslug);
	});
};

middleware.redirectToLoginIfGuest = function(req, res, next) {
	if (!req.user || parseInt(req.user.uid, 10) === 0) {
		return redirectToLogin(req, res);
	}

	next();
};

middleware.validateFiles = function(req, res, next) {
	if (!Array.isArray(req.files.files) || !req.files.files.length) {
		return next(new Error(['[[error:invalid-files]]']));
	}

	next();
};

middleware.prepareAPI = function(req, res, next) {
	res.locals.isAPI = true;
	next();
};

middleware.guestSearchingAllowed = function(req, res, next) {
	if (!req.user && parseInt(meta.config.allowGuestSearching, 10) !== 1) {
		return controllers.helpers.notAllowed(req, res);
	}

	next();
};

middleware.checkGlobalPrivacySettings = function(req, res, next) {
	if (!req.user && !!parseInt(meta.config.privateUserInfo, 10)) {
		return controllers.helpers.notAllowed(req, res);
	}

	next();
};

middleware.checkAccountPermissions = function(req, res, next) {
	// This middleware ensures that only the requested user and admins can pass
	async.waterfall([
		function (next) {
			middleware.authenticate(req, res, next);
		},
		function (next) {
			user.getUidByUserslug(req.params.userslug, next);
		},
		function (uid, next) {
			if (!uid) {
				return controllers.helpers.notFound(req, res);
			}

			if (parseInt(uid, 10) === req.uid) {
				return next(null, true);
			}

			user.isAdministrator(req.uid, next);
		}
	], function (err, allowed) {
		if (err || allowed) {
			return next(err);
		}
		controllers.helpers.notAllowed(req, res);
	});
};

middleware.isAdmin = function(req, res, next) {
	if (!req.user) {
		return redirectToLogin(req, res);
	}

	user.isAdministrator((req.user && req.user.uid) ? req.user.uid : 0, function (err, isAdmin) {
		if (err || isAdmin) {
			return next(err);
		}

		if (res.locals.isAPI) {
			return controllers.helpers.notAllowed(req, res);
		}

		middleware.buildHeader(req, res, function() {
			controllers.helpers.notAllowed(req, res);
		});
	});
};

middleware.buildHeader = function(req, res, next) {
	res.locals.renderHeader = true;
	res.locals.isAPI = false;

	middleware.applyCSRF(req, res, function() {
		async.parallel({
			config: function(next) {
				controllers.api.getConfig(req, res, next);
			},
			footer: function(next) {
				app.render('footer', {loggedIn: (req.user ? parseInt(req.user.uid, 10) !== 0 : false)}, next);
			},
			plugins: function(next) {
				plugins.fireHook('filter:middleware.buildHeader', {req: req, locals: res.locals}, next);
			}
		}, function(err, results) {
			if (err) {
				return next(err);
			}

			res.locals.config = results.config;

			translator.translate(results.footer, results.config.defaultLang, function(parsedTemplate) {
				res.locals.footer = parsedTemplate;
				next();
			});
		});
	});
};

middleware.renderHeader = function(req, res, data, callback) {
	var registrationType = meta.config.registrationType || 'normal';
	var templateValues = {
		bootswatchCSS: meta.config['theme:src'],
		title: meta.config.title || '',
		description: meta.config.description || '',
		'cache-buster': meta.config['cache-buster'] ? 'v=' + meta.config['cache-buster'] : '',
		'brand:logo': meta.config['brand:logo'] || '',
		'brand:logo:url': meta.config['brand:logo:url'] || '',
		'brand:logo:alt': meta.config['brand:logo:alt'] || '',
		'brand:logo:display': meta.config['brand:logo']?'':'hide',
		allowRegistration: registrationType === 'normal' || registrationType === 'admin-approval',
		searchEnabled: plugins.hasListeners('filter:search.query')
	};

	for (var key in res.locals.config) {
		if (res.locals.config.hasOwnProperty(key)) {
			templateValues[key] = res.locals.config[key];
		}
	}

	templateValues.configJSON = JSON.stringify(res.locals.config);

	async.parallel({
		customCSS: function(next) {
			templateValues.useCustomCSS = parseInt(meta.config.useCustomCSS, 10) === 1;
			if (!templateValues.useCustomCSS || !meta.config.customCSS || !meta.config.renderedCustomCSS) {
				return next(null, '');
			}
			next(null, meta.config.renderedCustomCSS);
		},
		customJS: function(next) {
			templateValues.useCustomJS = parseInt(meta.config.useCustomJS, 10) === 1;
			next(null, templateValues.useCustomJS ? meta.config.customJS : '');
		},
		settings: function(next) {
			if (req.uid) {
				user.getSettings(req.uid, next);
			} else {
				next();
			}
		},
		title: function(next) {
			var title = validator.escape(meta.config.browserTitle || meta.config.title || 'NodeBB');
			title = data.title ? (data.title + ' | ' + title) : title;
			next(null, title);
		},
		isAdmin: function(next) {
			user.isAdministrator(req.uid, next);
		},
		user: function(next) {
			if (req.uid) {
				user.getUserFields(req.uid, ['username', 'userslug', 'email', 'picture', 'status', 'email:confirmed', 'banned'], next);
			} else {
				next(null, {
					username: '[[global:guest]]',
					userslug: '',
					picture: user.createGravatarURLFromEmail(''),
					status: 'offline',
					banned: false,
					uid: 0
				});
			}
		},
		navigation: async.apply(navigation.get),
		tags: async.apply(meta.tags.parse, res.locals.metaTags, res.locals.linkTags)
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		if (results.user && parseInt(results.user.banned, 10) === 1) {
			req.logout();
			return res.redirect('/');
		}
		results.user.isAdmin = results.isAdmin || false;
		results.user.uid = parseInt(results.user.uid, 10);
		results.user['email:confirmed'] = parseInt(results.user['email:confirmed'], 10) === 1;

		if (results.settings && results.settings.bootswatchSkin && results.settings.bootswatchSkin !== 'default') {
			templateValues.bootswatchCSS = '//maxcdn.bootstrapcdn.com/bootswatch/latest/' + results.settings.bootswatchSkin + '/bootstrap.min.css';
		}

		templateValues.browserTitle = results.title;
		templateValues.navigation = results.navigation;
		templateValues.metaTags = results.tags.meta;
		templateValues.linkTags = results.tags.link;
		templateValues.isAdmin = results.user.isAdmin;
		templateValues.user = results.user;
		templateValues.userJSON = JSON.stringify(results.user);
		templateValues.customCSS = results.customCSS;
		templateValues.customJS = results.customJS;
		templateValues.maintenanceHeader = parseInt(meta.config.maintenanceMode, 10) === 1 && !results.isAdmin;
		templateValues.defaultLang = meta.config.defaultLang || 'en_GB';

		templateValues.template = {name: res.locals.template};
		templateValues.template[res.locals.template] = true;

		if (req.route.path === '/') {
			modifyTitle(templateValues);
		}

		plugins.fireHook('filter:middleware.renderHeader', {templateValues: templateValues, req: req, res: res}, function(err, data) {
			if (err) {
				return callback(err);
			}

			app.render('header', data.templateValues, callback);
		});
	});
};

middleware.processRender = function(req, res, next) {
	// res.render post-processing, modified from here: https://gist.github.com/mrlannigan/5051687
	var render = res.render;
	res.render = function(template, options, fn) {
		var self = this,
			req = this.req,
			app = req.app,
			defaultFn = function(err, str){
				if (err) {
					return req.next(err);
				}

				self.send(str);
			};

		options = options || {};

		if ('function' === typeof options) {
			fn = options;
			options = {};
		}

		options.loggedIn = req.user ? parseInt(req.user.uid, 10) !== 0 : false;
		options.template = {name: template};
		options.template[template] = true;
		res.locals.template = template;

		if ('function' !== typeof fn) {
			fn = defaultFn;
		}

		if (res.locals.isAPI) {
			if (req.route.path === '/api/') {
				options.title = '[[pages:home]]';
			}

			return res.json(options);
		}

		render.call(self, template, options, function(err, str) {
			if (err) {
				winston.error(err);
				return fn(err);
			}

			str = str + '<input type="hidden" ajaxify-data="' + encodeURIComponent(JSON.stringify(options)) + '" />';
			str = (res.locals.postHeader ? res.locals.postHeader : '') + str + (res.locals.preFooter ? res.locals.preFooter : '');

			if (res.locals.footer) {
				str = str + res.locals.footer;
			} else if (res.locals.adminFooter) {
				str = str + res.locals.adminFooter;
			}

			if (res.locals.renderHeader || res.locals.renderAdminHeader) {
				var method = res.locals.renderHeader ? middleware.renderHeader : middleware.admin.renderHeader;
				method(req, res, options, function(err, template) {
					if (err) {
						return fn(err);
					}
					str = template + str;
					var language = res.locals.config ? res.locals.config.userLang || 'en_GB' : 'en_GB';
					language = req.query.lang || language;
					translator.translate(str, language, function(translated) {
						fn(err, translated);
					});
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
		return res.sendFile(path.join(__dirname, '../../public', meta.config['brand:logo'] || '/logo.png'), {
			maxAge: app.enabled('cache') ? 5184000000 : 0
		});
	}
};

middleware.addExpiresHeaders = function(req, res, next) {
	if (app.enabled('cache')) {
		res.setHeader("Cache-Control", "public, max-age=5184000");
		res.setHeader("Expires", new Date(Date.now() + 5184000000).toUTCString());
	} else {
		res.setHeader("Cache-Control", "public, max-age=0");
		res.setHeader("Expires", new Date().toUTCString());
	}

	next();
};

middleware.maintenanceMode = function(req, res, next) {
	if (parseInt(meta.config.maintenanceMode, 10) !== 1) {
		return next();
	}

	var allowedRoutes = [
			'/login',
			'/stylesheet.css',
			'/nodebb.min.js',
			'/vendor/fontawesome/fonts/fontawesome-webfont.woff',
			'/src/(modules|client)/[\\w/]+.js',
			'/templates/[\\w/]+.tpl',
			'/api/login',
			'/api/?',
			'/language/.+',
			'/uploads/system/site-logo.png'
		],
		render = function() {
			res.status(503);

			if (!isApiRoute.test(req.url)) {
				middleware.buildHeader(req, res, function() {
					res.render('maintenance', {
						site_title: meta.config.title || 'NodeBB',
						message: meta.config.maintenanceModeMessage
					});
				});
			} else {
				translator.translate('[[pages:maintenance.text, ' + meta.config.title + ']]', meta.config.defaultLang || 'en_GB', function(translated) {
					res.json({
						error: translated
					});
				});
			}
		},
		isAllowed = function(url) {
			for(var x=0,numAllowed=allowedRoutes.length,route;x<numAllowed;x++) {
				route = new RegExp(allowedRoutes[x]);
				if (route.test(url)) {
					return true;
				}
			}
			return false;
		},
		isApiRoute = /^\/api/;

	if (isAllowed(req.url)) {
		return next();
	}

	if (!req.user) {
		return render();
	}

	user.isAdministrator(req.user.uid, function(err, isAdmin) {
		if (err) {
			return next(err);
		}
		if (!isAdmin) {
			render();
		} else {
			next();
		}
	});
};

middleware.privateTagListing = function(req, res, next) {
	if (!req.user && parseInt(meta.config.privateTagListing, 10) === 1) {
		controllers.helpers.notAllowed(req, res);
	} else {
		next();
	}
};

middleware.exposeGroupName = function(req, res, next) {
	if (!req.params.hasOwnProperty('slug')) { return next(); }

	groups.getGroupNameByGroupSlug(req.params.slug, function(err, groupName) {
		if (err) {
			return next(err);
		}

		res.locals.groupName = groupName;
		next();
	});
};

middleware.exposeUid = function(req, res, next) {
	if (req.params.hasOwnProperty('userslug')) {
		user.getUidByUserslug(req.params.userslug, function(err, uid) {
			if (err) {
				return next(err);
			}

			res.locals.uid = uid;
			next();
		});
	} else {
		next();
	}
};

middleware.requireUser = function(req, res, next) {
	if (req.user) {
		return next();
	}

	res.render('403', {});
};

function redirectToLogin(req, res) {
	req.session.returnTo = nconf.get('relative_path') + req.url.replace(/^\/api/, '');
	return controllers.helpers.redirect(res, '/login');
}

function modifyTitle(obj) {
	var title = '[[pages:home]] | ' + validator.escape(meta.config.title || 'NodeBB');
	obj.browserTitle = title;

	if (obj.metaTags) {
		obj.metaTags.forEach(function(tag, i) {
			if (tag.property === 'og:title') {
				obj.metaTags[i].content = title;
			}
		});
	}

	return title;
}

module.exports = function(webserver) {
	app = webserver;
	middleware.admin = require('./admin')(webserver);

	return middleware;
};
