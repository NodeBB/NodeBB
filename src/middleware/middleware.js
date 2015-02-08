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

	plugins = require('./../plugins'),
	meta = require('./../meta'),
	translator = require('./../../public/src/translator'),
	user = require('./../user'),
	db = require('./../database'),
	categories = require('./../categories'),
	topics = require('./../topics'),
	messaging = require('../messaging'),
	ensureLoggedIn = require('connect-ensure-login'),
	analytics = require('../analytics'),

	controllers = {
		api: require('./../controllers/api'),
		helpers: require('../controllers/helpers')
	};

middleware.authenticate = function(req, res, next) {
	if (req.user) {
		return next();
	}

	controllers.helpers.notAllowed(req, res);
};

middleware.applyCSRF = csrf();

middleware.ensureLoggedIn = ensureLoggedIn.ensureLoggedIn(nconf.get('relative_path') + '/login');

middleware.pageView = function(req, res, next) {
	if (req.user) {
		user.updateLastOnlineTime(req.user.uid);
		user.updateOnlineUsers(req.user.uid);
	}

	analytics.pageView(req.ip);

	next();
};

middleware.redirectToAccountIfLoggedIn = function(req, res, next) {
	if (!req.user) {
		return next();
	}
	user.getUserField(req.user.uid, 'userslug', function (err, userslug) {
		if (err) {
			return next(err);
		}

		if (res.locals.isAPI) {
			res.status(302).json(nconf.get('relative_path') + '/user/' + userslug);
		} else {
			res.redirect(nconf.get('relative_path') + '/user/' + userslug);
		}
	});
};

middleware.redirectToLoginIfGuest = function(req, res, next) {
	if (!req.user || parseInt(req.user.uid, 10) === 0) {
		req.session.returnTo = nconf.get('relative_path') + req.url.replace(/^\/api/, '');
		return res.redirect(nconf.get('relative_path') + '/login');
	} else {
		next();
	}
};

middleware.addSlug = function(req, res, next) {
	function redirect(method, id, name) {
		method(id, 'slug', function(err, slug) {
			if (err || !slug || slug === id + '/') {
				return next(err);
			}

			var url = nconf.get('relative_path') + name + encodeURI(slug);

			if (res.locals.isAPI) {
				res.status(302).json(url);
			} else {
				res.redirect(url);
			}
		});
	}

	if (!req.params.slug) {
		if (req.params.category_id) {
			return redirect(categories.getCategoryField, req.params.category_id, '/category/');
		} else if (req.params.topic_id) {
			return redirect(topics.getTopicField, req.params.topic_id, '/topic/');
		}
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
	var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

	if (callerUID === 0) {
		return controllers.helpers.notAllowed(req, res);
	}

	user.getUidByUserslug(req.params.userslug, function (err, uid) {
		if (err) {
			return next(err);
		}

		if (!uid) {
			return controllers.helpers.notFound(req, res);
		}

		if (parseInt(uid, 10) === callerUID) {
			return next();
		}

		user.isAdministrator(callerUID, function(err, isAdmin) {
			if (err || isAdmin) {
				return next(err);
			}

			controllers.helpers.notAllowed(req, res);
		});
	});
};

middleware.isAdmin = function(req, res, next) {
	function render() {
		if (res.locals.isAPI) {
			return controllers.helpers.notAllowed(req, res);
		}

		middleware.buildHeader(req, res, function() {
			controllers.helpers.notAllowed(req, res);
		});
	}
	if (!req.user) {
		return render();
	}

	user.isAdministrator((req.user && req.user.uid) ? req.user.uid : 0, function (err, isAdmin) {
		if (err || isAdmin) {
			return next(err);
		}

		render();
	});
};

middleware.buildHeader = function(req, res, next) {
	res.locals.renderHeader = true;

	middleware.applyCSRF(req, res, function() {
		async.parallel({
			config: function(next) {
				controllers.api.getConfig(req, res, next);
			},
			footer: function(next) {
				app.render('footer', {loggedIn: (req.user ? parseInt(req.user.uid, 10) !== 0 : false)}, next);
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

middleware.renderHeader = function(req, res, callback) {
	var uid = req.user ? parseInt(req.user.uid, 10) : 0;

	var custom_header = {
		uid: uid,
		'navigation': []
	};

	plugins.fireHook('filter:header.build', custom_header, function(err, custom_header) {
		if (err) {
			return callback(err);
		}

		var defaultMetaTags = [{
				name: 'viewport',
				content: 'width=device-width, initial-scale=1.0, user-scalable=no'
			}, {
				name: 'content-type',
				content: 'text/html; charset=UTF-8'
			}, {
				name: 'apple-mobile-web-app-capable',
				content: 'yes'
			}, {
				property: 'og:site_name',
				content: meta.config.title || 'NodeBB'
			}, {
				name: 'keywords',
				content: meta.config.keywords || ''
			}, {
				name: 'msapplication-badge',
				content: 'frequency=30; polling-uri=' + nconf.get('url') + '/sitemap.xml'
			}, {
				name: 'msapplication-square150x150logo',
				content: meta.config['brand:logo'] || ''
			}],
			defaultLinkTags = [{
				rel: 'apple-touch-icon',
				href: nconf.get('relative_path') + '/apple-touch-icon'
			}],
			templateValues = {
				bootswatchCSS: meta.config['theme:src'],
				title: meta.config.title || '',
				description: meta.config.description || '',
				'cache-buster': meta.config['cache-buster'] ? 'v=' + meta.config['cache-buster'] : '',
				'brand:logo': meta.config['brand:logo'] || '',
				'brand:logo:display': meta.config['brand:logo']?'':'hide',
				navigation: custom_header.navigation,
				allowRegistration: meta.config.allowRegistration === undefined || parseInt(meta.config.allowRegistration, 10) === 1,
				searchEnabled: plugins.hasListeners('filter:search.query')
			};

		for (var key in res.locals.config) {
			if (res.locals.config.hasOwnProperty(key)) {
				templateValues[key] = res.locals.config[key];
			}
		}

		templateValues.configJSON = JSON.stringify(res.locals.config);

		templateValues.metaTags = defaultMetaTags.concat(res.locals.metaTags || []).map(function(tag) {
			if(!tag || typeof tag.content !== 'string') {
				winston.warn('Invalid meta tag. ', tag);
				return tag;
			}

			tag.content = validator.escape(tag.content);
			return tag;
		});

		templateValues.linkTags = defaultLinkTags.concat(res.locals.linkTags || []);
		templateValues.linkTags.unshift({
			rel: "icon",
			type: "image/x-icon",
			href: nconf.get('relative_path') + '/favicon.ico'
		});


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
			title: function(next) {
				if (uid) {
					user.getSettings(uid, function(err, settings) {
						if (err) {
							return next(err);
						}
						meta.title.build(req.url.slice(1), settings.language, res.locals, next);
					});
				} else {
					meta.title.build(req.url.slice(1), meta.config.defaultLang, res.locals, next);
				}
			},
			isAdmin: function(next) {
				user.isAdministrator(uid, next);
			},
			user: function(next) {
				if (uid) {
					user.getUserFields(uid, ['username', 'userslug', 'picture', 'status', 'email:confirmed', 'banned'], next);
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
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			if (results.user && parseInt(results.user.banned, 10) === 1) {
				req.logout();
				res.redirect('/');
				return;
			}
			results.user.isAdmin = results.isAdmin || false;
			results.user.uid = parseInt(results.user.uid, 10);
			results.user['email:confirmed'] = parseInt(results.user['email:confirmed'], 10) === 1;

			templateValues.browserTitle = results.title;
			templateValues.isAdmin = results.user.isAdmin;
			templateValues.user = results.user;
			templateValues.userJSON = JSON.stringify(results.user);
			templateValues.customCSS = results.customCSS;
			templateValues.customJS = results.customJS;
			templateValues.maintenanceHeader = parseInt(meta.config.maintenanceMode, 10) === 1 && !results.isAdmin;

			app.render('header', templateValues, callback);
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
		options.template = {};
		options.template[template] = true;

		if ('function' !== typeof fn) {
			fn = defaultFn;
		}

		if (res.locals.isAPI) {
			return res.json(options);
		}

		render.call(self, template, options, function(err, str) {
			// str = str + '<input type="hidden" ajaxify-data="' + encodeURIComponent(JSON.stringify(options)) + '" />';
			str = (res.locals.postHeader ? res.locals.postHeader : '') + str + (res.locals.preFooter ? res.locals.preFooter : '');

			if (res.locals.footer) {
				str = str + res.locals.footer;
			} else if (res.locals.adminFooter) {
				str = str + res.locals.adminFooter;
			}

			if (res.locals.renderHeader) {
				middleware.renderHeader(req, res, function(err, template) {
					str = template + str;
					var language = res.locals.config ? res.locals.config.userLang || 'en_GB' : 'en_GB';
					translator.translate(str, language, function(translated) {
						fn(err, translated);
					});
				});
			} else if (res.locals.adminHeader) {
				str = res.locals.adminHeader + str;
				fn(err, str);
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
			'/src/modules/[\\w]+\.js',
			'/api/get_templates_listing',
			'/api/login',
			'/api/?',
			'/language/.+'
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

middleware.publicTagListing = function(req, res, next) {
	if (req.user || (!meta.config.hasOwnProperty('publicTagListing') || parseInt(meta.config.publicTagListing, 10) === 1)) {
		next();
	} else {
		controllers.helpers.notAllowed(req, res);
	}
};

module.exports = function(webserver) {
	app = webserver;
	middleware.admin = require('./admin')(webserver);

	return middleware;
};
