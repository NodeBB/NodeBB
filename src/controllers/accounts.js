"use strict";



var fs = require('fs'),
	nconf = require('nconf'),
	async = require('async'),
	validator = require('validator'),
	winston = require('winston'),

	db = require('../database'),
	user = require('../user'),
	posts = require('../posts'),
	topics = require('../topics'),
	groups = require('../groups'),
	messaging = require('../messaging'),
	utils = require('../../public/src/utils'),
	meta = require('../meta'),
	plugins = require('../plugins'),
	languages = require('../languages'),

	helpers = require('./helpers');


var accountsController = {
	profile: require('./accounts/profile'),
	edit: require('./accounts/edit')
};


accountsController.getUserByUID = function(req, res, next) {
	var uid = req.params.uid ? req.params.uid : 0;

	async.parallel({
		userData: async.apply(user.getUserData, uid),
		settings: async.apply(user.getSettings, uid)
	}, function(err, results) {
		if (err || !results.userData) {
			return next(err);
		}

		results.userData.email = results.settings.showemail ? results.userData.email : undefined;
		results.userData.fullname = results.settings.showfullname ? results.userData.fullname : undefined;

		res.json(results.userData);
	});
};


accountsController.getFollowing = function(req, res, next) {
	getFollow('account/following', 'following', req, res, next);
};

accountsController.getFollowers = function(req, res, next) {
	getFollow('account/followers', 'followers', req, res, next);
};

function getFollow(tpl, name, req, res, callback) {
	var userData;

	async.waterfall([
		function(next) {
			accountsController.getBaseUser(req.params.userslug, req.uid, next);
		},
		function(data, next) {
			userData = data;
			if (!userData) {
				return callback();
			}
			var method = name === 'following' ? 'getFollowing' : 'getFollowers';
			user[method](userData.uid, 0, 49, next);
		}
	], function(err, users) {
		if (err) {
			return callback(err);
		}

		userData.users = users;
		userData.nextStart = 50;
		userData.title = '[[pages:' + tpl + ', ' + userData.username + ']]';
		userData.breadcrumbs = helpers.buildBreadcrumbs([{text: userData.username, url: '/user/' + userData.userslug}, {text: '[[user:' + name + ']]'}]);

		res.render(tpl, userData);
	});
}

accountsController.getFavourites = function(req, res, next) {
	getFromUserSet('account/favourites', 'favourites', '[[user:favourites]]', posts.getPostSummariesFromSet, 'posts', req, res, next);
};

accountsController.getPosts = function(req, res, next) {
	getFromUserSet('account/posts', 'posts', '[[global:posts]]', posts.getPostSummariesFromSet, 'posts', req, res, next);
};

accountsController.getWatchedTopics = function(req, res, next) {
	getFromUserSet('account/watched', 'followed_tids', '[[user:watched]]',topics.getTopicsFromSet, 'topics', req, res, next);
};

accountsController.getTopics = function(req, res, next) {
	getFromUserSet('account/topics', 'topics', '[[global:topics]]', topics.getTopicsFromSet, 'topics', req, res, next);
};

accountsController.getGroups = function(req, res, next) {
	var userData;
	var groupsData;
	async.waterfall([
		function (next) {
			accountsController.getBaseUser(req.params.userslug, req.uid, next);
		},
		function (_userData, next) {
			userData = _userData;

			groups.getUserGroups([userData.uid], next);
		},
		function (_groupsData, next) {
			groupsData = _groupsData[0];
			var groupNames = groupsData.map(function(group) {
				return group.name;
			});

			groups.getMemberUsers(groupNames, 0, 3, next);
		},
		function (members, next) {
			groupsData.forEach(function(group, index) {
				group.members = members[index];
			});
			next();
		}
	], function(err) {
		if (err) {
			return next(err);
		}

		userData.groups = groupsData;
		userData.title = '[[pages:account/groups, ' + userData.username + ']]';
		userData.breadcrumbs = helpers.buildBreadcrumbs([{text: userData.username, url: '/user/' + userData.userslug}, {text: '[[global:header.groups]]'}]);
		res.render('account/groups', userData);
	});
};

function getFromUserSet(tpl, set, crumb, method, type, req, res, next) {
	async.parallel({
		settings: function(next) {
			user.getSettings(req.uid, next);
		},
		userData: function(next) {
			accountsController.getBaseUser(req.params.userslug, req.uid, next);
		}
	}, function(err, results) {
		if (err || !results.userData) {
			return next(err);
		}

		var userData = results.userData;

		var setName = 'uid:' + userData.uid + ':' + set;

		var page = Math.max(1, parseInt(req.query.page, 10) || 1);
		var itemsPerPage = (tpl === 'account/topics' || tpl === 'account/watched') ? results.settings.topicsPerPage : results.settings.postsPerPage;

		async.parallel({
			itemCount: function(next) {
				if (results.settings.usePagination) {
					db.sortedSetCard(setName, next);
				} else {
					next(null, 0);
				}
			},
			data: function(next) {
				var start = (page - 1) * itemsPerPage;
				var stop = start + itemsPerPage - 1;
				method(setName, req.uid, start, stop, next);
			}
		}, function(err, results) {
			if (err) {
				return next(err);
			}

			userData[type] = results.data[type];
			userData.nextStart = results.data.nextStart;
			var pageCount = Math.ceil(results.itemCount / itemsPerPage);

			var pagination = require('../pagination');
			userData.pagination = pagination.create(page, pageCount);

			userData.title = '[[pages:' + tpl + ', ' + userData.username + ']]';
			userData.breadcrumbs = helpers.buildBreadcrumbs([{text: userData.username, url: '/user/' + userData.userslug}, {text: crumb}]);

			res.render(tpl, userData);
		});
	});
}

accountsController.getBaseUser = function(userslug, callerUID, callback) {
	user.getUidByUserslug(userslug, function (err, uid) {
		if (err || !uid) {
			return callback(err);
		}

		async.parallel({
			user: function(next) {
				user.getUserFields(uid, ['uid', 'username', 'userslug'], next);
			},
			isAdmin: function(next) {
				user.isAdministrator(callerUID, next);
			},
			profile_links: function(next) {
				plugins.fireHook('filter:user.profileLinks', [], next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			if (!results.user) {
				return callback();
			}

			results.user.yourid = callerUID;
			results.user.theirid = uid;
			results.user.isSelf = parseInt(callerUID, 10) === parseInt(uid, 10);
			results.user.showHidden = results.user.isSelf || results.isAdmin;
			results.user.profile_links = results.profile_links;
			callback(null, results.user);
		});
	});
};

accountsController.accountSettings = function(req, res, callback) {
	var userData;
	async.waterfall([
		function(next) {
			accountsController.getBaseUser(req.params.userslug, req.uid, next);
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
					groups.getUserGroups([userData.uid], next);
				},
				languages: function(next) {
					languages.list(next);
				}
			}, next);
		},
		function(results, next) {
			userData.settings = results.settings;
			userData.languages = results.languages;
			userData.userGroups = results.userGroups[0];
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

		userData.title = '[[pages:account/settings]]';
		userData.breadcrumbs = helpers.buildBreadcrumbs([{text: userData.username, url: '/user/' + userData.userslug}, {text: '[[user:settings]]'}]);

		res.render('account/settings', userData);
	});
};

accountsController.uploadPicture = function (req, res, next) {
	var userPhoto = req.files.files[0];

	var updateUid = req.uid;

	async.waterfall([
		function(next) {
			user.getUidByUserslug(req.params.userslug, next);
		},
		function(uid, next) {
			if (parseInt(updateUid, 10) === parseInt(uid, 10)) {
				return next();
			}

			user.isAdministrator(req.uid, function(err, isAdmin) {
				if (err) {
					return next(err);
				}

				if (!isAdmin) {
					return helpers.notAllowed(req, res);
				}
				updateUid = uid;
				next();
			});
		},
		function(next) {
			user.uploadPicture(updateUid, userPhoto, next);
		}
	], function(err, image) {
		fs.unlink(userPhoto.path, function(err) {
			winston.error('unable to delete picture ' + userPhoto.path, err);
		});
		if (err) {
			return next(err);
		}

		res.json([{name: userPhoto.name, url: image.url.startsWith('http') ? image.url : nconf.get('relative_path') + image.url}]);
	});
};

accountsController.getNotifications = function(req, res, next) {
	user.notifications.getAll(req.uid, 40, function(err, notifications) {
		if (err) {
			return next(err);
		}
		res.render('notifications', {
			notifications: notifications,
			title: '[[pages:notifications]]',
			breadcrumbs: helpers.buildBreadcrumbs([{text: '[[pages:notifications]]'}])
		});
	});
};

accountsController.getChats = function(req, res, callback) {
	if (parseInt(meta.config.disableChat, 10) === 1) {
		return callback();
	}

	// In case a userNAME is passed in instead of a slug, the route should not 404
	var slugified = utils.slugify(req.params.userslug);
	if (req.params.userslug && req.params.userslug !== slugified) {
		return res.redirect(nconf.get('relative_path') + '/chats/' + slugified);
	}

	async.parallel({
		contacts: async.apply(user.getFollowing, req.user.uid, 0, 199),
		recentChats: async.apply(messaging.getRecentChats, req.user.uid, 0, 19)
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		if (results.recentChats.users && results.recentChats.users.length) {
			var contactUids = results.recentChats.users.map(function(chatObj) {
					return parseInt(chatObj.uid, 10);
				});

			results.contacts = results.contacts.filter(function(contact) {
				return contactUids.indexOf(parseInt(contact.uid, 10)) === -1;
			});
		}

		if (!req.params.userslug) {
			return res.render('chats', {
				chats: results.recentChats.users,
				nextStart: results.recentChats.nextStart,
				contacts: results.contacts,
				allowed: true,
				title: '[[pages:chats]]',
				breadcrumbs: helpers.buildBreadcrumbs([{text: '[[pages:chats]]'}])
			});
		}

		async.waterfall([
			async.apply(user.getUidByUserslug, req.params.userslug),
			function(toUid, next) {
				if (!toUid || parseInt(toUid, 10) === parseInt(req.user.uid, 10)) {
					return callback();
				}

				async.parallel({
					toUser: async.apply(user.getUserFields, toUid, ['uid', 'username']),
					messages: async.apply(messaging.getMessages, {
						fromuid: req.user.uid,
						touid: toUid,
						since: 'recent',
						isNew: false
					}),
					allowed: async.apply(messaging.canMessage, req.user.uid, toUid)
				}, next);
			}
		], function(err, data) {
			if (err) {
				return callback(err);
			}

			res.render('chats', {
				chats: results.recentChats.users,
				nextStart: results.recentChats.nextStart,
				contacts: results.contacts,
				meta: data.toUser,
				messages: data.messages,
				allowed: data.allowed,
				title: '[[pages:chat, ' + data.toUser.username + ']]',
				breadcrumbs: helpers.buildBreadcrumbs([{text: '[[pages:chats]]', url: '/chats'}, {text: data.toUser.username}])
			});
		});
	});
};

module.exports = accountsController;
