"use strict";

var async = require('async'),
	fs = require('fs'),
	path = require('path'),

	user = require('../user'),
	categories = require('../categories'),
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
	topics: {},
	groups: {},
	appearance: {},
	extend: {
		widgets: {}
	},
	events: {},
	database: {},
	plugins: {},
	languages: {},
	settings: {},
	logger: {},
	sounds: {},
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
				{done: !meta.restartRequired, doneText: 'Restart not required', notDoneText:'Restart required'},
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
			getStatsForSet('ip:recent', next);
		},
		function(next) {
			getStatsForSet('users:joindate', next);
		},
		function(next) {
			getStatsForSet('posts:pid', next);
		},
		function(next) {
			getStatsForSet('topics:tid', next);
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

function getStatsForSet(set, callback) {
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
			db.sortedSetCount(set, 0, now, next);
		}
	}, callback);
}

adminController.categories.active = function(req, res, next) {
	filterAndRenderCategories(req, res, next, true);
};

adminController.categories.disabled = function(req, res, next) {
	filterAndRenderCategories(req, res, next, false);
};

function filterAndRenderCategories(req, res, next, active) {
	var uid = req.user ? parseInt(req.user.uid, 10) : 0;
	categories.getAllCategories(uid, function (err, categoryData) {
		if (err) {
			return next(err);
		}

		categoryData = categoryData.filter(function (category) {
			if (!category) {
				return false;
			}
			return active ? !category.disabled : category.disabled;
		});

		res.render('admin/manage/categories', {
			categories: categoryData,
			csrf: req.csrfToken()
		});
	});
}

adminController.tags.get = function(req, res, next) {
	topics.getTags(0, 99, function(err, tags) {
		if (err) {
			return next(err);
		}

		res.render('admin/manage/tags', {tags: tags});
	});
};

adminController.database.get = function(req, res, next) {
	db.info(function (err, data) {
		res.render('admin/advanced/database', data);
	});
};

adminController.events.get = function(req, res, next) {
	events.getLog(function(err, data) {
		if(err || !data) {
			return next(err);
		}

		data = data.toString().split('\n').reverse().join('\n');
		res.render('admin/advanced/events', {
			eventdata: data
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
	})
};

adminController.languages.get = function(req, res, next) {
	languages.list(function(err, languages) {
		res.render('admin/general/languages', {
			languages: languages
		});
	});
};

adminController.settings.get = function(req, res, next) {
	var term = req.params.term ? req.params.term : 'general';

	res.render('admin/settings/' + term, {
		'csrf': req.csrfToken()
	});
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
			];

			plugins.fireHook('filter:widgets.getAreas', defaultAreas, next);
		},
		widgets: function(next) {
			plugins.fireHook('filter:widgets.getWidgets', [], next);
		}
	}, function(err, widgetData) {
		widgetData.areas.push({ name: 'Draft Zone', template: 'global', location: 'drafts' });

		async.each(widgetData.areas, function(area, next) {
			widgets.getArea(area.template, area.location, function(err, areaData) {
				area.data = areaData;
				next(err);
			});
		}, function(err) {
			for (var w in widgetData.widgets) {
				if (widgetData.widgets.hasOwnProperty(w)) {
					// if this gets anymore complicated, it needs to be a template
					widgetData.widgets[w].content += "<br /><label>Title:</label><input type=\"text\" class=\"form-control\" name=\"title\" placeholder=\"Title (only shown on some containers)\" /><br /><label>Container:</label><textarea rows=\"4\" class=\"form-control container-html\" name=\"container\" placeholder=\"Drag and drop a container or enter HTML here.\"></textarea><div class=\"checkbox\"><label><input name=\"registered-only\" type=\"checkbox\"> Hide from anonymous users?</label></div>";
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


adminController.groups.get = function(req, res, next) {
	groups.list({
		expand: true,
		showSystemGroups: true,
		truncateUserList: true
	}, function(err, groups) {
		groups = groups.filter(function(group) {
			return group.name !== 'registered-users' && group.name !== 'guests';
		});
		res.render('admin/manage/groups', {
			groups: groups,
			yourid: req.user.uid
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

adminController.themes.get = function(req, res, next) {
	var themeDir = path.join(__dirname, '../../node_modules/' + req.params.theme);
	fs.exists(themeDir, function(exists) {
		if (exists) {
			var themeConfig = require(path.join(themeDir, 'theme.json')),
				screenshotPath = path.join(themeDir, themeConfig.screenshot);
			if (themeConfig.screenshot && fs.existsSync(screenshotPath)) {
				res.sendfile(screenshotPath);
			} else {
				res.sendfile(path.join(__dirname, '../../public/images/themes/default.png'));
			}
		} else {
			return next();
		}
	});
}

module.exports = adminController;
