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
			if (res.locals.isAPI) {
				return res.json(302, '/user/' + userslug);
			} else {
				res.redirect('/user/' + userslug);
			}
		});
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
			var url = name + encodeURI(slug);
			res.locals.isAPI ? res.json(302, url) : res.redirect(url);
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

middleware.checkPostIndex = function(req, res, next) {
	topics.getPostCount(req.params.topic_id, function(err, postCount) {
		if (err) {
			return next(err);
		}
		var postIndex = parseInt(req.params.post_index, 10);
		postCount = parseInt(postCount, 10) + 1;
		var url = '';
		if (postIndex > postCount) {
			url = '/topic/' + req.params.topic_id + '/' + req.params.slug + '/' + postCount;
			return res.locals.isAPI ? res.json(302, url) : res.redirect(url);
		} else if (postIndex < 1) {
			url = '/topic/' + req.params.topic_id + '/' + req.params.slug;
			return res.locals.isAPI ? res.json(302, url) : res.redirect(url);
		}
		next();
	});
};

middleware.checkTopicIndex = function(req, res, next) {
	db.sortedSetCard('categories:' + req.params.category_id + ':tid', function(err, topicCount) {
		if (err) {
			return next(err);
		}
		var topicIndex = parseInt(req.params.topic_index, 10);
		topicCount = parseInt(topicCount, 10) + 1;
		var url = '';
		console.log(topicIndex, topicCount);
		if (topicIndex > topicCount) {
			url = '/category/' + req.params.category_id + '/' + req.params.slug + '/' + topicCount;
			return res.locals.isAPI ? res.json(302, url) : res.redirect(url);
		} else if (topicIndex < 1) {
			url = '/category/' + req.params.category_id + '/' + req.params.slug;
			return res.locals.isAPI ? res.json(302, url) : res.redirect(url);
		}
		next();
	});
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
			return res.redirect('login?next=' + req.url);
		}
	}

	next();
};

middleware.checkAccountPermissions = function(req, res, next) {
	// This middleware ensures that only the requested user and admins can pass
	var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

	if (callerUID === 0) {
		return res.redirect('/login?next=' + req.url);
	}

	user.getUidByUserslug(req.params.userslug, function (err, uid) {
		if (err) {
			return next(err);
		}

		if (!uid) {
			if (res.locals.isAPI) {
				return res.json(404, 'not-found');
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
	res.locals.renderHeader = true;
	async.parallel({
		config: function(next) {
			controllers.api.getConfig(req, res, next);
		},
		footer: function(next) {
			app.render('footer', {}, next);
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
};

middleware.renderHeader = function(req, res, callback) {
	var uid = req.user ? parseInt(req.user.uid, 10) : 0;

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
				csrf: res.locals.csrf_token,
				navigation: custom_header.navigation,
				allowRegistration: meta.config.allowRegistration === undefined || parseInt(meta.config.allowRegistration, 10) === 1,
				searchEnabled: plugins.hasListeners('filter:search.query')
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


		async.parallel({
			customCSS: function(next) {
				templateValues.useCustomCSS = parseInt(meta.config.useCustomCSS, 10) === 1;
				if (!templateValues.useCustomCSS) {
					return next(null, '');
				}

				var less = require('less');
				var parser = new (less.Parser)();

				parser.parse(meta.config.customCSS, function(err, tree) {
					if (!err) {
						next(err, tree ? tree.toCSS({cleancss: true}) : '');
					} else {
						winston.error('[less] Could not convert custom LESS to CSS! Please check your syntax.');
						next(undefined, '');
					}
				});
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
						meta.title.build(req.url.slice(1), settings.language, next);
					});
				} else {
					meta.title.build(req.url.slice(1), meta.config.defaultLang, next);
				}
			},
			isAdmin: function(next) {
				user.isAdministrator(uid, next);
			},
			user: function(next) {
				if (uid) {
					user.getUserFields(uid, ['username', 'userslug', 'picture', 'status'], next);
				} else {
					next();
				}
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			templateValues.browserTitle = results.title;
			templateValues.isAdmin = results.isAdmin || false;
			templateValues.user = results.user;
			templateValues.customCSS = results.customCSS;
			templateValues.customJS = results.customJS;

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

		if ('function' !== typeof fn) {
			fn = defaultFn;
		}

		if (res.locals.isAPI) {
			return res.json(options);
		}

		render.call(self, template, options, function(err, str) {
			str = (res.locals.postHeader ? res.locals.postHeader : '') + str + (res.locals.preFooter ? res.locals.preFooter : '');

			if (res.locals.footer) {
				str = str + res.locals.footer;
			} else if (res.locals.adminFooter) {
				str = str + res.locals.adminFooter;
			}

			if (res.locals.renderHeader) {
				middleware.renderHeader(req, res, function(err, template) {
					str = template + str;

					translator.translate(str, res.locals.config.defaultLang, function(translated) {
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
