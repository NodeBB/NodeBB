"use strict";

var async = require('async'),
	fs = require('fs'),
	path = require('path'),
	nconf = require('nconf'),

	user = require('../user'),
	categories = require('../categories'),
	privileges = require('../privileges'),
	posts = require('../posts'),
	topics = require('../topics'),
	meta = require('../meta'),
	db = require('../database'),
	events = require('../events'),
	languages = require('../languages'),
	plugins = require('../plugins'),
	validator = require('validator');


var adminController = {
	categories: {},
	tags: {},
	flags: {},
	topics: {},
	groups: require('./admin/groups'),
	appearance: {},
	extend: {
		widgets: {}
	},
	events: {},
	logs: {},
	database: {},
	postCache: {},
	plugins: {},
	languages: {},
	settings: {},
	logger: {},
	sounds: {},
	homepage: {},
	navigation: {},
	themes: {},
	users: require('./admin/users'),
	uploads: require('./admin/uploads')
};

adminController.home = function(req, res, next) {
	async.parallel({
		stats: function(next) {
			getStats(next);
		},
		notices: function(next) {
			var notices = [
				{
					done: !meta.reloadRequired,
					doneText: 'Reload not required',
					notDoneText:'Reload required'
				},
				{
					done: plugins.hasListeners('action:email.send'),
					doneText: 'Emailer Installed',
					notDoneText:'Emailer not installed',
					tooltip:'Install an emailer plugin from the plugin page in order to activate registration emails and email digests',
					link:'/admin/extend/plugins'
				},
				{
					done: plugins.hasListeners('filter:search.query'),
					doneText: 'Search Plugin Installed',
					notDoneText:'Search Plugin not installed',
					tooltip: 'Install a search plugin from the plugin page in order to activate search functionality',
					link:'/admin/extend/plugins'
				}
			];
			plugins.fireHook('filter:admin.notices', notices, next);
		}
	}, function(err, results) {
		if (err) {
			return next(err);
		}
		res.render('admin/general/dashboard', {
			version: nconf.get('version'),
			notices: results.notices,
			stats: results.stats
		});
	});
};

function getStats(callback) {
	async.parallel([
		function(next) {
			getStatsForSet('ip:recent', 'uniqueIPCount', next);
		},
		function(next) {
			getStatsForSet('users:joindate', 'userCount', next);
		},
		function(next) {
			getStatsForSet('posts:pid', 'postCount', next);
		},
		function(next) {
			getStatsForSet('topics:tid', 'topicCount', next);
		}
	], function(err, results) {
		if (err) {
			return callback(err);
		}
		results[0].name = 'Unique Visitors';
		results[1].name = 'Users';
		results[2].name = 'Posts';
		results[3].name = 'Topics';

		callback(null, results);
	});
}

function getStatsForSet(set, field, callback) {
	var terms = {
		day: 86400000,
		week: 604800000,
		month: 2592000000
	};

	var now = Date.now();
	async.parallel({
		day: function(next) {
			db.sortedSetCount(set, now - terms.day, now, next);
		},
		week: function(next) {
			db.sortedSetCount(set, now - terms.week, now, next);
		},
		month: function(next) {
			db.sortedSetCount(set, now - terms.month, now, next);
		},
		alltime: function(next) {
			getGlobalField(field, next);
		}
	}, callback);
}

function getGlobalField(field, callback) {
	db.getObjectField('global', field, function(err, count) {
		callback(err, parseInt(count, 10) || 0);
	});
}

adminController.categories.get = function(req, res, next) {
	async.parallel({
		category: async.apply(categories.getCategories, [req.params.category_id], req.user.uid),
		privileges: async.apply(privileges.categories.list, req.params.category_id)
	}, function(err, data) {
		if (err) {
			return next(err);
		}

		plugins.fireHook('filter:admin.category.get', {req: req, res: res, category: data.category[0], privileges: data.privileges}, function(err, data) {
			if (err) {
				return next(err);
			}

			res.render('admin/manage/category', {
				category: data.category,
				privileges: data.privileges
			});
		});
	});
};

adminController.categories.getAll = function(req, res, next) {
	//Categories list will be rendered on client side with recursion, etc.
	res.render('admin/manage/categories', {});
};

adminController.tags.get = function(req, res, next) {
	topics.getTags(0, 199, function(err, tags) {
		if (err) {
			return next(err);
		}

		res.render('admin/manage/tags', {tags: tags});
	});
};

adminController.flags.get = function(req, res, next) {
	function done(err, posts) {
		if (err) {
			return next(err);
		}
		res.render('admin/manage/flags', {posts: posts, next: stop + 1, byUsername: byUsername});
	}

	var sortBy = req.query.sortBy || 'count';
	var byUsername = req.query.byUsername || '';
	var start = 0;
	var stop = 19;

	if (byUsername) {
		posts.getUserFlags(byUsername, sortBy, req.uid, start, stop, done);
	} else {
		var set = sortBy === 'count' ? 'posts:flags:count' : 'posts:flagged';
		posts.getFlags(set, req.uid, start, stop, done);
	}
};

adminController.database.get = function(req, res, next) {
	async.parallel({
		redis: function(next) {
			if (nconf.get('redis')) {
				var rdb = require('../database/redis');
				var cxn = rdb.connect();
				rdb.info(cxn, next);
			} else {
				next();
			}
		},
		mongo: function(next) {
			if (nconf.get('mongo')) {
				var mdb = require('../database/mongo');
				mdb.info(mdb.client, next);
			} else {
				next();
			}
		}
	}, function(err, results) {
		if (err) {
			return next(err);
		}
		res.render('admin/advanced/database', results);
	});
};

adminController.events.get = function(req, res, next) {
	events.getEvents(0, 19, function(err, events) {
		if(err || !events) {
			return next(err);
		}

		res.render('admin/advanced/events', {
			events: events,
			next: 20
		});
	});
};

adminController.logs.get = function(req, res, next) {
	meta.logs.get(function(err, logs) {
		res.render('admin/advanced/logs', {
			data: validator.escape(logs)
		});
	});
};

adminController.postCache.get = function(req, res, next) {
	var cache = require('../posts/cache');
	var avgPostSize = 0;
	var percentFull = 0;
	if (cache.itemCount > 0) {
		avgPostSize = parseInt((cache.length / cache.itemCount), 10);
		percentFull = ((cache.length / cache.max) * 100).toFixed(2);
	}

	res.render('admin/advanced/post-cache', {
		cache: {
			length: cache.length,
			max: cache.max,
			itemCount: cache.itemCount,
			percentFull: percentFull,
			avgPostSize: avgPostSize
		}
	});
};

adminController.plugins.get = function(req, res, next) {
	async.parallel({
		compatible: function(next) {
			plugins.list(function(err, plugins) {
				if (err || !Array.isArray(plugins)) {
					plugins = [];
				}

				next(null, plugins);
			});
		},
		all: function(next) {
			plugins.list(false, function(err, plugins) {
				if (err || !Array.isArray(plugins)) {
					plugins = [];
				}

				next(null, plugins);
			});
		}
	}, function(err, payload) {
		var compatiblePkgNames = payload.compatible.map(function(pkgData) {
				return pkgData.name;
			});

		res.render('admin/extend/plugins' , {
			installed: payload.compatible.filter(function(plugin) {
				return plugin.installed;
			}),
			download: payload.compatible.filter(function(plugin) {
				return !plugin.installed;
			}),
			incompatible: payload.all.filter(function(plugin) {
				return compatiblePkgNames.indexOf(plugin.name) === -1;
			})
		});
	});
};

adminController.languages.get = function(req, res, next) {
	languages.list(function(err, languages) {
		if (err) {
			return next(err);
		}

		languages.forEach(function(language) {
			language.selected = language.code === (meta.config.defaultLang || 'en_GB');
		});

		res.render('admin/general/languages', {
			languages: languages
		});
	});
};

adminController.sounds.get = function(req, res, next) {
	meta.sounds.getFiles(function(err, sounds) {
		sounds = Object.keys(sounds).map(function(name) {
			return {
				name: name
			};
		});

		res.render('admin/general/sounds', {
			sounds: sounds
		});
	});
};

adminController.navigation.get = function(req, res, next) {
	require('../navigation/admin').getAdmin(function(err, data) {
		if (err) {
			return next(err);
		}

		res.render('admin/general/navigation', data);
	});
};

adminController.homepage.get = function(req, res, next) {
	async.parallel({
		categoryData: function(next) {
			async.waterfall([
				function(next) {
					db.getSortedSetRange('cid:0:children', 0, -1, next);
				},
				function(cids, next) {
					privileges.categories.filterCids('find', cids, 0, next);
				},
				function(cids, next) {
					categories.getMultipleCategoryFields(cids, ['name', 'slug'], next);
				},
				function(categoryData, next) {
					async.map(categoryData, function(category, next) {
						var route = 'category/' + category.slug,
							hook = 'action:homepage.get:' + route;

						next(null, {
							route: route,
							name: 'Category: ' + category.name
						});
					}, next);
				}
			], next);
		}
	}, function(err, results) {
		if (err || !results || !results.categoryData) results = {categoryData:[]};

		plugins.fireHook('filter:homepage.get', {routes: [
			{
				route: 'categories',
				name: 'Categories'
			},
			{
				route: 'recent',
				name: 'Recent'
			},
			{
				route: 'popular',
				name: 'Popular'
			}
		].concat(results.categoryData)}, function(err, data) {
			data.routes.push({
				route: '',
				name: 'Custom'
			});

			res.render('admin/general/homepage', data);
		});
	});
};

adminController.settings.get = function(req, res, next) {
	var term = req.params.term ? req.params.term : 'general';

	res.render('admin/settings/' + term);
};

adminController.logger.get = function(req, res, next) {
	res.render('admin/development/logger', {});
};

adminController.appearance.get = function(req, res, next) {
	var term = req.params.term ? req.params.term : 'themes';

	res.render('admin/appearance/' + term, {});
};

adminController.extend.widgets = function(req, res, next) {
	require('../widgets/admin').get(function(err, data) {
		if (err) {
			return next(err);
		}

		res.render('admin/extend/widgets', data);
	});
};

adminController.extend.rewards = function(req, res, next) {
	require('../rewards/admin').get(function(err, data) {
		if (err) {
			return next(err);
		}

		res.render('admin/extend/rewards', data);
	});
};

adminController.themes.get = function(req, res, next) {
	var themeDir = path.join(__dirname, '../../node_modules/' + req.params.theme);
	fs.exists(themeDir, function(exists) {
		if (exists) {
			var themeConfig = require(path.join(themeDir, 'theme.json')),
				screenshotPath = path.join(themeDir, themeConfig.screenshot);
			if (themeConfig.screenshot && fs.existsSync(screenshotPath)) {
				res.sendFile(screenshotPath);
			} else {
				res.sendFile(path.join(__dirname, '../../public/images/themes/default.png'));
			}
		} else {
			return next();
		}
	});
};

module.exports = adminController;
