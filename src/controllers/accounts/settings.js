'use strict';

var async = require('async');

var user = require('../../user');
var groups = require('../../groups');
var languages = require('../../languages');
var meta = require('../../meta');
var plugins = require('../../plugins');
var privileges = require('../../privileges');
var categories = require('../../categories');
var db = require('../../database');
var helpers = require('../helpers');
var accountHelpers = require('./helpers');


var settingsController = {};


settingsController.get = function(req, res, callback) {
	var userData;
	async.waterfall([
		function(next) {
			accountHelpers.getBaseUser(req.params.userslug, req.uid, next);
		},
		function(_userData, next) {
			userData = _userData;
			if (!userData) {
				return callback();
			}
			async.parallel({
				settings: function(next) {
					user.getSettings(userData.uid, next);
				},
				userGroups: function(next) {
					groups.getUserGroupsFromSet('groups:createtime', [userData.uid], next);
				},
				languages: function(next) {
					languages.list(next);
				},
				homePageRoutes: function(next) {
					getHomePageRoutes(next);
				},
				ips: function (next) {
					user.getIPs(userData.uid, 4, next);
				},
				sessions: async.apply(user.auth.getSessions, userData.uid, req.sessionID)
			}, next);
		},
		function(results, next) {
			userData.settings = results.settings;
			userData.userGroups = results.userGroups[0].filter(function(group) {
				return group && group.userTitleEnabled && !groups.isPrivilegeGroup(group.name) && group.name !== 'registered-users';
			});
			userData.languages = results.languages;
			userData.homePageRoutes = results.homePageRoutes;
			userData.ips = results.ips;
			userData.sessions = results.sessions;
			plugins.fireHook('filter:user.customSettings', {settings: results.settings, customSettings: [], uid: req.uid}, next);
		},
		function(data, next) {
			userData.customSettings = data.customSettings;
			userData.disableEmailSubscriptions = parseInt(meta.config.disableEmailSubscriptions, 10) === 1;
			next();
		}
	], function(err) {
		if (err) {
			return callback(err);
		}

		userData.dailyDigestFreqOptions = [
			{value: 'off', name: '[[user:digest_off]]', selected: 'off' === userData.settings.dailyDigestFreq},
			{value: 'day', name: '[[user:digest_daily]]', selected: 'day' === userData.settings.dailyDigestFreq},
			{value: 'week', name: '[[user:digest_weekly]]', selected: 'week' === userData.settings.dailyDigestFreq},
			{value: 'month', name: '[[user:digest_monthly]]', selected: 'month' === userData.settings.dailyDigestFreq}
		];


		userData.bootswatchSkinOptions = [
			{ "name": "Default", "value": "default" },
			{ "name": "Cerulean", "value": "cerulean" },
			{ "name": "Cosmo", "value": "cosmo"	},
			{ "name": "Cyborg", "value": "cyborg" },
			{ "name": "Darkly", "value": "darkly" },
			{ "name": "Flatly", "value": "flatly" },
			{ "name": "Journal", "value": "journal"	},
			{ "name": "Lumen", "value": "lumen" },
			{ "name": "Paper", "value": "paper" },
			{ "name": "Readable", "value": "readable" },
			{ "name": "Sandstone", "value": "sandstone" },
			{ "name": "Simplex", "value": "simplex" },
			{ "name": "Slate", "value": "slate"	},
			{ "name": "Spacelab", "value": "spacelab" },
			{ "name": "Superhero", "value": "superhero" },
			{ "name": "United", "value": "united" },
			{ "name": "Yeti", "value": "yeti" }
		];

		var isCustom = true;
		userData.homePageRoutes.forEach(function(route) {
			route.selected = route.route === userData.settings.homePageRoute;
			if (route.selected) {
				isCustom = false;
			}
		});

		userData.homePageRoutes.push({
		 	route: 'custom',
		 	name: 'Custom',
		 	selected: isCustom
		});

		userData.bootswatchSkinOptions.forEach(function(skin) {
			skin.selected = skin.value === userData.settings.bootswatchSkin;
		});

		userData.userGroups.forEach(function(group) {
			group.selected = group.name === userData.settings.groupTitle;
		});

		userData.languages.forEach(function(language) {
			language.selected = language.code === userData.settings.userLang;
		});

		userData.disableCustomUserSkins = parseInt(meta.config.disableCustomUserSkins, 10) === 1;

		userData.allowUserHomePage = parseInt(meta.config.allowUserHomePage, 10) === 1;

		userData.title = '[[pages:account/settings]]';
		userData.breadcrumbs = helpers.buildBreadcrumbs([{text: userData.username, url: '/user/' + userData.userslug}, {text: '[[user:settings]]'}]);

		res.render('account/settings', userData);
	});
};


function getHomePageRoutes(callback) {
	async.waterfall([
		function (next) {
			db.getSortedSetRange('cid:0:children', 0, -1, next);
		},
		function (cids, next) {
			privileges.categories.filterCids('find', cids, 0, next);
		},
		function (cids, next) {
			categories.getCategoriesFields(cids, ['name', 'slug'], next);
		},
		function (categoryData, next) {
			categoryData = categoryData.map(function(category) {
				return {
					route: 'category/' + category.slug,
					name: 'Category: ' + category.name
				};
			});

			categoryData = categoryData || [];

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
			].concat(categoryData)}, next);
		},
		function (data, next) {
			next(null, data.routes);
		}
	], callback);
}


module.exports = settingsController;