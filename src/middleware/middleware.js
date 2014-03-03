"use strict";

var app,
	clientScripts,
	middleware = {},
	async = require('async'),
	path = require('path'),
	winston = require('winston'),
	validator = require('validator'),
	fs = require('fs'),
	nconf = require('nconf'),
	plugins = require('./../plugins'),
	meta = require('./../meta'),
	translator = require('./../../public/src/translator'),
	user = require('./../user'),
	db = require('./../database'),

	controllers = {
		api: require('./../controllers/api')
	};

middleware.authenticate = function(req, res, next) {
	if(!req.user) {
		if (res.locals.isAPI) {
			return res.json(403, 'not-allowed');	
		} else {
			return res.redirect('403');
		}
	} else {
		next();
	}
};

middleware.updateLastOnlineTime = function(req, res, next) {
	if(req.user) {
		user.updateLastOnlineTime(req.user.uid);
	}

	db.sortedSetAdd('ip:recent', Date.now(), req.ip || 'Unknown');

	next();
};

middleware.prepareAPI = function(req, res, next) {
	res.locals.isAPI = true;
	next();
};

middleware.checkGlobalPrivacySettings = function(req, res, next) {
	var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

	if (!callerUID && !!parseInt(meta.config.privateUserInfo, 10)) {
		if (res.locals.isAPI) {
			return res.json(403, 'not-allowed');
		} else {
			return res.redirect('403');
		}
	}

	next();
};

middleware.checkAccountPermissions = function(req, res, next) {
	var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

	// this function requires userslug to be passed in. todo: /user/uploadpicture should pass in userslug I think
	user.getUidByUserslug(req.params.userslug, function (err, uid) {
		if (err) {
			return next(err);
		}

		// not sure if this check really should belong here. also make sure we're not doing this check again in the actual method
		if (!uid) {
			if (res.locals.isAPI) {
				return res.json(404);
			} else {
				return res.redirect('404');
			}
		}

		if (parseInt(uid, 10) === callerUID) {
			return next();
		}

		user.isAdministrator(callerUID, function(err, isAdmin) {
			if(err) {
				return next(err);
			}

			if(isAdmin) {
				next();
			}

			if (res.locals.isAPI) {
				return res.json(403, 'not-allowed');
			} else {
				return res.redirect('403');
			}
		});
	});
};

middleware.buildHeader = function(req, res, next) {
	async.parallel([
		function(next) {
			res.locals.renderHeader = true;
			next();
		},
		function(next) {
			controllers.api.getConfig(req, res, function(err, config) {
				res.locals.config = config;
				next();
			});
		},
		function(next) {
			// this is slower than the original implementation because the rendered template is not cached
			// but I didn't bother to fix this because we will deprecate [filter:footer.build] in favour of the widgets system by 0.4x
			plugins.fireHook('filter:footer.build', '', function(err, appendHTML) {
				app.render('footer', {footerHTML: appendHTML}, function(err, template) {
					translator.translate(template, function(parsedTemplate) {
						res.locals.footer = template;
						next(err);
					});
				});
			});
		}
	], function(err) {
		next();
	});
};

/**
* TODO: switch signature to req, res, callback
 *	`options` object	requires:	req, res
 *						accepts:	metaTags, linkTags
 */
middleware.renderHeader = function (options, callback) {
	var custom_header = {
		'navigation': []
	};

	plugins.fireHook('filter:header.build', custom_header, function(err, custom_header) {
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
				property: 'keywords',
				content: meta.config.keywords || ''
			}],
			defaultLinkTags = [{
				rel: 'apple-touch-icon',
				href: '/apple-touch-icon'
			}],
			templateValues = {
				bootswatchCSS: meta.config['theme:src'],
				pluginCSS: plugins.cssFiles.map(function(file) { return { path: nconf.get('relative_path') + file.replace(/\\/g, '/') }; }),
				title: meta.config.title || '',
				description: meta.config.description || '',
				'brand:logo': meta.config['brand:logo'] || '',
				'brand:logo:display': meta.config['brand:logo']?'':'hide',
				csrf: options.res.locals.csrf_token,
				relative_path: nconf.get('relative_path'),
				clientScripts: clientScripts,
				navigation: custom_header.navigation,
				'cache-buster': meta.config['cache-buster'] ? 'v=' + meta.config['cache-buster'] : '',
				allowRegistration: meta.config.allowRegistration === undefined || parseInt(meta.config.allowRegistration, 10) === 1,
				searchEnabled: plugins.hasListeners('filter:search.query') ? true : false
			},
			escapeList = {
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				"'": '&apos;',
				'"': '&quot;'
			};

		for (var key in options.res.locals.config) {
			if (options.res.locals.config.hasOwnProperty(key)) {
				templateValues[key] = options.res.locals.config[key];
			}
		}

		var uid = '0';

		templateValues.metaTags = defaultMetaTags.concat(options.res.locals.metaTags || []).map(function(tag) {
			if(!tag || typeof tag.content !== 'string') {
				winston.warn('Invalid meta tag. ', tag);
				return tag;
			}

			tag.content = tag.content.replace(/[&<>'"]/g, function(tag) {
				return escapeList[tag] || tag;
			});
			return tag;
		});

		templateValues.linkTags = defaultLinkTags.concat(options.linkTags || []);
		templateValues.linkTags.push({
			rel: "icon",
			type: "image/x-icon",
			href: nconf.get('relative_path') + '/favicon.ico'
		});

		if(options.req.user && options.req.user.uid) {
			uid = options.req.user.uid;
		}

		templateValues.useCustomCSS = false;
		if (meta.config.useCustomCSS === '1') {
			templateValues.useCustomCSS = true;
			templateValues.customCSS = meta.config.customCSS;
		}

		async.parallel([
			function(next) {
				translator.get('pages:' + path.basename(options.req.url), function(translated) {
					var	metaTitle = templateValues.metaTags.filter(function(tag) {
							return tag.name === 'title';
						});
					if (translated) {
						templateValues.browserTitle = translated;
					} else if (metaTitle.length > 0 && metaTitle[0].content) {
						templateValues.browserTitle = metaTitle[0].content;
					} else {
						templateValues.browserTitle = meta.config.browserTitle || 'NodeBB';
					}

					next();
				});
			},
			function(next) {
				user.isAdministrator(uid, function(err, isAdmin) {
					templateValues.isAdmin = isAdmin || false;
					next();
				});
			}
		], function() {
			app.render('header', templateValues, function(err, template) {
				callback(null, template);
			});
		});
	});
};

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

		if ('function' === typeof options) {
			fn = options, options = {};
		}

		if ('function' !== typeof fn) {
			fn = defaultFn;
		}

		render.call(self, template, options, function(err, str) {
			if (res.locals.footer) {
				str = str + res.locals.footer;
			}

			if (res.locals.renderHeader) {
				middleware.renderHeader({
					req: req,
					res: res
				}, function(err, template) {
					str = template + str;

					translator.translate(str, function(translated) {
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
		return res.sendfile(path.join(__dirname, '../../public', meta.config['brand:logo'] || nconf.get('relative_path') + '/logo.png'), {
			maxAge: app.enabled('cache') ? 5184000000 : 0
		});
	}
};

module.exports = function(webserver) {
	app = webserver;

	plugins.ready(function() {
		// Minify client-side libraries
		meta.js.get(function (err, scripts) {
			clientScripts = scripts.map(function (script) {
				script = {
					script: script
				};

				return script;
			});
		});
	});

	return middleware;
};