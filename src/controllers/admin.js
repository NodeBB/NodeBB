"use strict";

var async = require('async'),

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
	topics: {},
	groups: {},
	themes: {},
	events: {},
	database: {},
	plugins: {},
	languages: {},
	settings: {},
	logger: {},
	sounds: {},
	users: require('./admin/users'),
	uploads: require('./admin/uploads')
};

adminController.home = function(req, res, next) {
	res.render('admin/index', {
		version: pkg.version,
		emailerInstalled: plugins.hasListeners('action:email.send'),
		searchInstalled: plugins.hasListeners('filter:search.query'),
		restartRequired: meta.restartRequired
	});
};

adminController.categories.active = function(req, res, next) {
	filterAndRenderCategories(req, res, next, true);
};

adminController.categories.disabled = function(req, res, next) {
	filterAndRenderCategories(req, res, next, false);
};

function filterAndRenderCategories(req, res, next, active) {
	categories.getAllCategories(function (err, categoryData) {
		categoryData = categoryData.filter(function (category) {
			return active ? !category.disabled : category.disabled;
		});

		res.render('admin/categories', {categories: categoryData});
	});
}

adminController.database.get = function(req, res, next) {
	db.info(function (err, data) {
		res.render('admin/database', data);
	});
};

adminController.events.get = function(req, res, next) {
	events.getLog(function(err, data) {
		if(err || !data) {
			return next(err);
		}

		data = data.toString().split('\n').reverse().join('\n');
		res.render('admin/events', {
			eventdata: data
		});
	});
};

adminController.plugins.get = function(req, res, next) {
	plugins.getAll(function(err, plugins) {
		if (err || !Array.isArray(plugins)) {
			plugins = [];
		}

		res.render('admin/plugins' , {
			plugins: plugins
		});
	})
};

adminController.languages.get = function(req, res, next) {
	languages.list(function(err, languages) {
		res.render('admin/languages', {
			languages: languages
		});
	});
};

adminController.settings.get = function(req, res, next) {
	res.render('admin/settings', {});
};

adminController.logger.get = function(req, res, next) {
	res.render('admin/logger', {});
};

adminController.themes.get = function(req, res, next) {
	async.parallel({
		areas: function(next) {
			var defaultAreas = [
				{ name: 'Global Sidebar', template: 'global', location: 'sidebar' },
				{ name: 'Global Footer', template: 'global', location: 'footer' },
			];

			plugins.fireHook('filter:widgets.getAreas', defaultAreas, next);
		},
		widgets: function(next) {
			plugins.fireHook('filter:widgets.getWidgets', [], next);
		}
	}, function(err, widgetData) {
		widgetData.areas.push({ name: 'Drafts', template: 'global', location: 'drafts' });

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

			var branding = [];

			for (var key in meta.css.branding) {
				if (meta.css.branding.hasOwnProperty(key)) {
					branding.push({
						key: key,
						value: meta.css.branding[key]
					});
				}
			}

			res.render('admin/themes', {
				areas: widgetData.areas,
				widgets: widgetData.widgets,
				branding: branding
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
		res.render('admin/groups', {
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

		res.render('admin/sounds', {
			sounds: sounds
		});
	});
};

module.exports = adminController;
