"use strict";

var async = require('async'),
	fs = require('fs'),
	path = require('path'),

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
	widgets = require('../widgets'),
	groups = require('../groups'),
	pkg = require('../../package.json'),
	validator = require('validator');


var adminController = {
	categories: {},
	tags: {},
	flags: {},
	topics: {},
	groups: {},
	appearance: {},
	extend: {
		widgets: {}
	},
	events: {},
	logs: {},
	database: {},
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
				{done: !meta.reloadRequired, doneText: 'Reload not required', notDoneText:'Reload required'},
				{done: plugins.hasListeners('action:email.send'), doneText: 'Emailer Installed', notDoneText:'Emailer not installed'},
				{done: plugins.hasListeners('filter:search.query'), doneText: 'Search Plugin Installed', notDoneText:'Search Plugin not installed'}
			];
			plugins.fireHook('filter:admin.notices', notices, next);
		}
	}, function(err, results) {
		if (err) {
			return next(err);
		}
		res.render('admin/general/dashboard', {
			version: pkg.version,
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
		category: async.apply(categories.getCategoryData, req.params.category_id),
		privileges: async.apply(privileges.categories.list, req.params.category_id)
	}, function(err, data) {
		if (err) {
			return next(err);
		}

		res.render('admin/manage/category', {
			category: data.category,
			privileges: data.privileges
		});
	});
};

adminController.categories.getAll = function(req, res, next) {
	var uid = req.user ? parseInt(req.user.uid, 10) : 0,
		active = [],
		disabled = [];

	categories.getAllCategories(uid, function (err, categoryData) {
		if (err) {
			return next(err);
		}

		categoryData.filter(Boolean).forEach(function(category) {
			(category.disabled ? disabled : active).push(category);
		});

		res.render('admin/manage/categories', {
			active: active,
			disabled: disabled
		});
	});
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
		res.render('admin/manage/flags', {posts: posts, next: end + 1, byUsername: byUsername});
	}
	var uid = req.user ? parseInt(req.user.uid, 10) : 0;
	var sortBy = req.query.sortBy || 'count';
	var byUsername = req.query.byUsername || '';
	var start = 0;
	var end = 19;

	if (byUsername) {
		posts.getUserFlags(byUsername, sortBy, uid, start, end, done);
	} else {
		var set = sortBy === 'count' ? 'posts:flags:count' : 'posts:flagged';
		posts.getFlags(set, uid, start, end, done);	
	}	
};

adminController.database.get = function(req, res, next) {
	db.info(function (err, data) {
		res.render('admin/advanced/database', data);
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

adminController.plugins.get = function(req, res, next) {
	plugins.getAll(function(err, plugins) {
		if (err || !Array.isArray(plugins)) {
			plugins = [];
		}

		res.render('admin/extend/plugins' , {
			plugins: plugins
		});
	});
};

adminController.languages.get = function(req, res, next) {
	languages.list(function(err, languages) {
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
	]}, function(err, data) {
		res.render('admin/general/homepage', data);
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
	async.parallel({
		areas: function(next) {
			var defaultAreas = [
				{ name: 'Global Sidebar', template: 'global', location: 'sidebar' },
				{ name: 'Global Header', template: 'global', location: 'header' },
				{ name: 'Global Footer', template: 'global', location: 'footer' },

				{ name: 'Group Page (Left)', template: 'groups/details.tpl', location: 'left'},
				{ name: 'Group Page (Right)', template: 'groups/details.tpl', location: 'right'}
			];

			plugins.fireHook('filter:widgets.getAreas', defaultAreas, next);
		},
		widgets: function(next) {
			plugins.fireHook('filter:widgets.getWidgets', [], next);
		}
	}, function(err, widgetData) {
		if (err) {
			return next(err);
		}
		widgetData.areas.push({ name: 'Draft Zone', template: 'global', location: 'drafts' });

		async.each(widgetData.areas, function(area, next) {
			widgets.getArea(area.template, area.location, function(err, areaData) {
				area.data = areaData;
				next(err);
			});
		}, function(err) {
			if (err) {
				return next(err);
			}
			for (var w in widgetData.widgets) {
				if (widgetData.widgets.hasOwnProperty(w)) {
					// if this gets anymore complicated, it needs to be a template
					widgetData.widgets[w].content += "<br /><label>Title:</label><input type=\"text\" class=\"form-control\" name=\"title\" placeholder=\"Title (only shown on some containers)\" /><br /><label>Container:</label><textarea rows=\"4\" class=\"form-control container-html\" name=\"container\" placeholder=\"Drag and drop a container or enter HTML here.\"></textarea><div class=\"checkbox\"><label><input name=\"hide-guests\" type=\"checkbox\"> Hide from anonymous users?</label></div><div class=\"checkbox\"><label><input name=\"hide-registered\" type=\"checkbox\"> Hide from registered users?</input></label></div>";
				}
			}

			var templates = [],
				list = {}, index = 0;

			widgetData.areas.forEach(function(area) {
				if (typeof list[area.template] === 'undefined') {
					list[area.template] = index;
					templates.push({
						template: area.template,
						areas: []
					});

					index++;
				}

				templates[list[area.template]].areas.push({
					name: area.name,
					location: area.location
				});
			});

			res.render('admin/extend/widgets', {
				templates: templates,
				areas: widgetData.areas,
				widgets: widgetData.widgets
			});
		});
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

adminController.groups.get = function(req, res, next) {
	groups.list({
		expand: true,
		truncateUserList: true,
		isAdmin: true,
		showSystemGroups: true
	}, function(err, groups) {
		groups = groups.filter(function(group) {
			return group.name !== 'registered-users' && group.name !== 'guests' && group.name.indexOf(':privileges:') === -1;
		});
		res.render('admin/manage/groups', {
			groups: groups,
			yourid: req.user.uid
		});
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
