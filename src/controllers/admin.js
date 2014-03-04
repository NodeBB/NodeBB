"use strict";

var async = require('async'),

	user = require('./../user'),
	categories = require('./../categories'),
	topics = require('./../topics'),
	db = require('./../database'),
	events = require('./../events'),
	languages = require('./../languages'),
	plugins = require('./../plugins'),
	widgets = require('./../widgets'),
	groups = require('./../groups'),
	pkg = require('./../../package.json');

var adminController = {
	users: {},
	categories: {},
	topics: {},
	groups: {},
	themes: {},
	events: {},
	database: {},
	plugins: {},
	languages: {},
	settings: {},
	logger: {}
};

adminController.home = function(req, res, next) {
	var data = {
		version: pkg.version,
		emailerInstalled: plugins.hasListeners('action:email.send'),
		searchInstalled: plugins.hasListeners('filter:search.query')
	};

	if (res.locals.isAPI) {
		res.json(data);
	} else {
		res.render('admin/index', data);
	}
};

adminController.users.search = function(req, res, next) {
	var data = {
		search_display: 'block',
		loadmore_display: 'none',
		users: []
	};

	if (res.locals.isAPI) {
		res.json(data);
	} else {
		res.render('admin/users', data);
	}
};

adminController.users.latest = function(req, res, next) {
	user.getUsers('users:joindate', 0, 49, function(err, users) {
		var data = {
			search_display: 'none',
			loadmore_display: 'block',
			users: users,
			yourid: req.user.uid
		};

		if (res.locals.isAPI) {
			res.json(data);
		} else {
			res.render('admin/users', data);
		}
	});
};

adminController.users.sortByPosts = function(req, res, next) {
	user.getUsers('users:postcount', 0, 49, function(err, users) {
		var data = {
			search_display: 'none',
			loadmore_display: 'block',
			users: users,
			yourid: req.user.uid
		};

		if (res.locals.isAPI) {
			res.json(data);
		} else {
			res.render('admin/users', data);
		}
	});
};

adminController.users.sortByReputation = function(req, res, next) {
	user.getUsers('users:reputation', 0, 49, function(err, users) {
		var data = {
			search_display: 'none',
			loadmore_display: 'block',
			users: users,
			yourid: req.user.uid
		};

		if (res.locals.isAPI) {
			res.json(data);
		} else {
			res.render('admin/users', data);
		}
	});
};

adminController.users.sortByJoinDate = function(req, res, next) {
	user.getUsers('users:joindate', 0, 49, function(err, users) {
		var data = {
			search_display: 'none',
			users: users,
			yourid: req.user.uid
		};

		if (res.locals.isAPI) {
			res.json(data);
		} else {
			res.render('admin/users', data);
		}
	});
};

adminController.categories.active = function(req, res, next) {
	categories.getAllCategories(0, function (err, data) {
		data.categories = data.categories.filter(function (category) {
			return !category.disabled;
		});
		if (res.locals.isAPI) {
			res.json(data);
		} else {
			res.render('admin/categories', data);
		}
	});
};

adminController.categories.disabled = function(req, res, next) {
	categories.getAllCategories(0, function (err, data) {
		data.categories = data.categories.filter(function (category) {
			return category.disabled;
		});

		if (res.locals.isAPI) {
			res.json(data);
		} else {
			res.render('admin/categories', data);
		}
	});
};

adminController.database.get = function(req, res, next) {
	db.info(function (err, data) {
		if (res.locals.isAPI) {
			res.json(data);
		} else {
			res.render('admin/database', data);
		}
	});
};

// todo: deprecate this seemingly useless view
adminController.topics.get = function(req, res, next) {
	topics.getAllTopics(0, 19, function (err, topics) {
		var data = {
			topics: topics,
			notopics: topics.length === 0
		};

		if (res.locals.isAPI) {
			res.json(data);
		} else {
			res.render('admin/topics', data);
		}
	});
};

adminController.events.get = function(req, res, next) {
	events.getLog(function(err, data) {
		if(err || !data) {
			return next(err);
		}
		
		data = data.toString().split('\n').reverse().join('\n');

		if (res.locals.isAPI) {
			res.json({eventdata: data});
		} else {
			res.render('admin/events', {eventdata: data});
		}
	});
};

adminController.plugins.get = function(req, res, next) {
	plugins.showInstalled(function (err, plugins) {
		if (err || !Array.isArray(plugins)) {
			plugins = [];
		}

		if (res.locals.isAPI) {
			res.json({plugins: plugins});
		} else {
			res.render('admin/plugins', {plugins: plugins});
		}
	});
};

adminController.languages.get = function(req, res, next) {
	languages.list(function(err, languages) {
		if (res.locals.isAPI) {
			res.json({languages: languages});
		} else {
			res.render('admin/languages', {languages: languages});
		}
	});
};

adminController.settings.get = function(req, res, next) {
	if (res.locals.isAPI) {
		res.json({});
	} else {
		res.render('admin/settings', {});
	}
};

adminController.logger.get = function(req, res, next) {
	if (res.locals.isAPI) {
		res.json({});
	} else {
		res.render('admin/logger', {});
	}
};

adminController.themes.get = function(req, res, next) {
	async.parallel({
		areas: function(next) {
			plugins.fireHook('filter:widgets.getAreas', [], next);
		},
		widgets: function(next) {
			plugins.fireHook('filter:widgets.getWidgets', [], next);
		}
	}, function(err, widgetData) {
		async.each(widgetData.areas, function(area, next) {
			widgets.getArea(area.template, area.location, function(err, areaData) {
				area.data = areaData;
				next(err);
			});
		}, function(err) {
			for (var w in widgetData.widgets) {
				if (widgetData.widgets.hasOwnProperty(w)) {
					widgetData.widgets[w].content += "<br /><label>Title:</label><input type=\"text\" class=\"form-control\" name=\"title\" placeholder=\"Title (only shown on some containers)\" /><br /><label>Container:</label><textarea rows=\"4\" class=\"form-control container-html\" name=\"container\" placeholder=\"Drag and drop a container or enter HTML here.\"></textarea>";
				}
			}

			var data = {
				areas: widgetData.areas,
				widgets: widgetData.widgets
			};

			if (res.locals.isAPI) {
				res.json(data);
			} else {
				res.render('admin/themes', data);
			}
		});
	});
};

adminController.groups.get = function(req, res, next) {
	async.parallel([
		function(next) {
			groups.list({
				expand: true
			}, next);
		},
		function(next) {
			groups.listSystemGroups({
				expand: true
			}, next);
		}
	], function(err, groupData) {
		var	groups = groupData[0].concat(groupData[1]),
			data = {
				groups: groups,
				yourid: req.user.uid
			};

		if (res.locals.isAPI) {
			res.json(data);
		} else {
			res.render('admin/groups', data);
		}
	});
};

module.exports = adminController;