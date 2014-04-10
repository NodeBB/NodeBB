"use strict";

var app,
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
	categories = require('./../categories'),
	topics = require('./../topics'),

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

middleware.redirectToAccountIfLoggedIn = function(req, res, next) {
	if (req.user) {
		user.getUserField(req.user.uid, 'userslug', function (err, userslug) {
			res.redirect('/user/' + userslug);
		});
	} else {
		next();
	}
};

middleware.addSlug = function(req, res, next) {
	function redirect(method, id, name) {
		method(id, 'slug', function(err, slug) {
			if (err || !slug) {
				return next(err);
			}
			res.redirect(name + slug);
		});
	}

	if (!req.params.slug) {
		if (req.params.category_id) {
			redirect(categories.getCategoryField, req.params.category_id, '/category/');
		} else if (req.params.topic_id) {
			redirect(topics.getTopicField, req.params.topic_id, '/topic/');
		} else {
			return next();
		}
		return;
	}
	next();
};

middleware.prepareAPI = function(req, res, next) {
	res.locals.isAPI = true;
	next();
};

middleware.guestSearchingAllowed = function(req, res, next) {
	if (!req.user && meta.config.allowGuestSearching !== '1') {
		return res.redirect('/403');
	}

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
				return next();
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
			// consider caching this, since no user specific information is loaded here
			app.render('footer', {}, function(err, template) {
				translator.translate(template, function(parsedTemplate) {
					res.locals.footer = parsedTemplate;
					next(err);
				});
			});
		}
	], function(err) {
		next(err);
	});
};

middleware.renderHeader = function(req, res, callback) {
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
				href: nconf.get('relative_path') + '/apple-touch-icon'
			}],
			templateValues = {
				bootswatchCSS: meta.config['theme:src'],
				title: meta.config.title || '',
				description: meta.config.description || '',
				'cache-buster': meta.config['cache-buster'] ? 'v=' + meta.config['cache-buster'] : '',
				'brand:logo': meta.config['brand:logo'] || '',
				'brand:logo:display': meta.config['brand:logo']?'':'hide',
				csrf: res.locals.csrf_token,
				navigation: custom_header.navigation,
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

		for (var key in res.locals.config) {
			if (res.locals.config.hasOwnProperty(key)) {
				templateValues[key] = res.locals.config[key];
			}
		}

		var uid = '0';

		templateValues.metaTags = defaultMetaTags.concat(res.locals.metaTags || []).map(function(tag) {
			if(!tag || typeof tag.content !== 'string') {
				winston.warn('Invalid meta tag. ', tag);
				return tag;
			}

			tag.content = tag.content.replace(/[&<>'"]/g, function(tag) {
				return escapeList[tag] || tag;
			});
			return tag;
		});

		templateValues.linkTags = defaultLinkTags.concat(res.locals.linkTags || []);
		templateValues.linkTags.unshift({
			rel: "icon",
			type: "image/x-icon",
			href: nconf.get('relative_path') + '/favicon.ico'
		});

		if(req.user && req.user.uid) {
			uid = req.user.uid;
		}

		templateValues.useCustomCSS = false;
		if (meta.config.useCustomCSS === '1') {
			templateValues.useCustomCSS = true;
			templateValues.customCSS = meta.config.customCSS;
		}

		async.parallel([
			function(next) {
				translator.get('pages:' + path.basename(req.url), function(translated) {
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

		if ('function' !== typeof fn) {
			fn = defaultFn;
		}

		if (res.locals.isAPI) {
			return res.json(options);
		}

		render.call(self, template, options, function(err, str) {
			if (res.locals.footer) {
				str = str + res.locals.footer;
			} else if (res.locals.adminFooter) {
				str = str + res.locals.adminFooter;
			}

			if (res.locals.renderHeader) {
				middleware.renderHeader(req, res, function(err, template) {
					str = template + str;

					translator.translate(str, function(translated) {
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
		return res.sendfile(path.join(__dirname, '../../public', meta.config['brand:logo'] || '/logo.png'), {
			maxAge: app.enabled('cache') ? 5184000000 : 0
		});
	}
};

module.exports = function(webserver) {
	app = webserver;
	middleware.admin = require('./admin')(webserver);

	return middleware;
};
