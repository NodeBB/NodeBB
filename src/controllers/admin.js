"use strict";

var async = require('async'),
	fs = require('fs'),
	path = require('path'),

	user = require('./../user'),
	categories = require('./../categories'),
	topics = require('./../topics'),
	db = require('./../database'),
	events = require('./../events'),
	languages = require('./../languages'),
	plugins = require('./../plugins'),
	widgets = require('./../widgets'),
	groups = require('./../groups'),
	pkg = require('./../../package.json'),	
	image = require('./../image'),
	file = require('./../file');



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
	logger: {},
	uploads: {}
};

adminController.home = function(req, res, next) {
	res.render('admin/index', {
		version: pkg.version,
		emailerInstalled: plugins.hasListeners('action:email.send'),
		searchInstalled: plugins.hasListeners('filter:search.query')
	});
};

adminController.users.search = function(req, res, next) {
	res.render('admin/users', {
		search_display: 'block',
		loadmore_display: 'none',
		users: []
	});
};

adminController.users.latest = function(req, res, next) {
	user.getUsers('users:joindate', 0, 49, function(err, users) {
		res.render('admin/users', {
			search_display: 'none',
			loadmore_display: 'block',
			users: users,
			yourid: req.user.uid
		});
	});
};

adminController.users.sortByPosts = function(req, res, next) {
	user.getUsers('users:postcount', 0, 49, function(err, users) {
		res.render('admin/users', {
			search_display: 'none',
			loadmore_display: 'block',
			users: users,
			yourid: req.user.uid
		});
	});
};

adminController.users.sortByReputation = function(req, res, next) {
	user.getUsers('users:reputation', 0, 49, function(err, users) {
		res.render('admin/users', {
			search_display: 'none',
			loadmore_display: 'block',
			users: users,
			yourid: req.user.uid
		});
	});
};

adminController.users.sortByJoinDate = function(req, res, next) {
	user.getUsers('users:joindate', 0, 49, function(err, users) {
		res.render('admin/users', {
			search_display: 'none',
			users: users,
			yourid: req.user.uid
		});
	});
};

adminController.users.getCSV = function(req, res, next) {
	user.getUsersCSV(function(err, data) {
		res.attachment('users.csv');
		res.setHeader('Content-Type', 'text/csv');
		res.end(data);
	});
};

adminController.categories.active = function(req, res, next) {
	categories.getAllCategories(0, function (err, data) {
		data.categories = data.categories.filter(function (category) {
			return !category.disabled;
		});

		res.render('admin/categories', data);
	});
};

adminController.categories.disabled = function(req, res, next) {
	categories.getAllCategories(0, function (err, data) {
		data.categories = data.categories.filter(function (category) {
			return category.disabled;
		});

		res.render('admin/categories', data);
	});
};

adminController.database.get = function(req, res, next) {
	db.info(function (err, data) {
		res.render('admin/database', data);
	});
};

// todo: deprecate this seemingly useless view
adminController.topics.get = function(req, res, next) {
	topics.getAllTopics(0, 19, function (err, topics) {
		res.render('admin/topics', {
			topics: topics,
			notopics: topics.length === 0
		});
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
	plugins.showInstalled(function (err, plugins) {
		if (err || !Array.isArray(plugins)) {
			plugins = [];
		}

		res.render('admin/plugins', {
			plugins: plugins
		});
	});
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

			res.render('admin/themes', {
				areas: widgetData.areas,
				widgets: widgetData.widgets
			});
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
		var	groups = groupData[0].concat(groupData[1]);

		res.render('admin/groups', {
			groups: groups,
			yourid: req.user.uid
		});
	});
};

adminController.uploads.uploadImage = function(filename, req, res) {
	function done(err, image) {
		var er, rs;
		fs.unlink(req.files.userPhoto.path);

		if(err) {
			er = {error: err.message};
			return res.send(req.xhr ? er : JSON.stringify(er));
		}

		rs = {path: image.url};
		res.send(req.xhr ? rs : JSON.stringify(rs));
	}

	if(plugins.hasListeners('filter:uploadImage')) {
		plugins.fireHook('filter:uploadImage', req.files.userPhoto, done);
	} else {
		file.saveFileToLocal(filename, req.files.userPhoto.path, done);
	}
};

adminController.uploads.uploadCategoryPicture = function(req, res, next) {
	if (!req.user) {
		return res.redirect('/403');
	}

	var allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'],
		params = null, er;
	try {
		params = JSON.parse(req.body.params);
	} catch (e) {
		er = {
			error: 'Error uploading file! Error :' + e.message
		};
		return res.send(req.xhr ? er : JSON.stringify(er));
	}

	if (allowedTypes.indexOf(req.files.userPhoto.type) === -1) {
		er = {
			error: 'Allowed image types are png, jpg and gif!'
		};
		res.send(req.xhr ? er : JSON.stringify(er));
		return;
	}

	var filename =  'category-' + params.cid + path.extname(req.files.userPhoto.name);

	adminController.uploads.uploadImage(filename, req, res);
};

adminController.uploads.uploadFavicon = function(req, res, next) {
	if (!req.user) {
		return res.redirect('/403');
	}

	var allowedTypes = ['image/x-icon', 'image/vnd.microsoft.icon'],
		er;

	if (allowedTypes.indexOf(req.files.userPhoto.type) === -1) {
		er = {error: 'You can only upload icon file type!'};
		res.send(req.xhr ? er : JSON.stringify(er));
		return;
	}

	file.saveFileToLocal('favicon.ico', req.files.userPhoto.path, function(err, image) {
		fs.unlink(req.files.userPhoto.path);

		if(err) {
			er = {error: err.message};
			return res.send(req.xhr ? er : JSON.stringify(er));
		}

		var rs = {path: image.url};
		res.send(req.xhr ? rs : JSON.stringify(rs));
	});
};

adminController.uploads.uploadLogo = function(req, res, next) {
	if (!req.user) {
		return res.redirect('/403');
	}

	var allowedTypes = ['image/png', 'image/jpeg', 'image/pjpeg', 'image/jpg', 'image/gif'],
		er;

	if (allowedTypes.indexOf(req.files.userPhoto.type) === -1) {
		er = {error: 'Allowed image types are png, jpg and gif!'};
		res.send(req.xhr ? er : JSON.stringify(er));
		return;
	}

	var filename = 'site-logo' + path.extname(req.files.userPhoto.name);

	adminController.uploads.uploadImage(filename, req, res);
};


module.exports = adminController;