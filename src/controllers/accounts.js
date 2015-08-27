"use strict";

var accountsController = {};

var fs = require('fs'),
	nconf = require('nconf'),
	async = require('async'),
	validator = require('validator'),

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

function getUserDataByUserSlug(userslug, callerUID, callback) {
	user.getUidByUserslug(userslug, function(err, uid) {
		if (err) {
			return callback(err);
		}

		if (!uid) {
			return callback(null, null);
		}

		async.parallel({
			userData : function(next) {
				user.getUserData(uid, next);
			},
			userSettings : function(next) {
				user.getSettings(uid, next);
			},
			isAdmin : function(next) {
				user.isAdministrator(callerUID, next);
			},
			ips: function(next) {
				user.getIPs(uid, 4, next);
			},
			profile_links: function(next) {
				plugins.fireHook('filter:user.profileLinks', [], next);
			},
			groups: function(next) {
				groups.getUserGroups([uid], next);
			}
		}, function(err, results) {
			if(err || !results.userData) {
				return callback(err || new Error('[[error:invalid-uid]]'));
			}

			var userData = results.userData;
			var userSettings = results.userSettings;
			var isAdmin = results.isAdmin;
			var self = parseInt(callerUID, 10) === parseInt(userData.uid, 10);

			userData.joindate = utils.toISOString(userData.joindate);
			userData.lastonline = userData.lastonline ? utils.toISOString(userData.lastonline) : userData.joindate;
			userData.age = userData.birthday ? Math.floor((new Date().getTime() - new Date(userData.birthday).getTime()) / 31536000000) : '';

			if (!(isAdmin || self || (userData.email && userSettings.showemail))) {
				userData.email = '';
			}

			userData.emailClass = (self && !userSettings.showemail) ? '' : 'hide';

			if (!self && !userSettings.showfullname) {
				userData.fullname = '';
			}

			if (isAdmin || self) {
				userData.ips = results.ips;
			}

			userData.uid = userData.uid;
			userData.yourid = callerUID;
			userData.theirid = userData.uid;
			userData.isAdmin = isAdmin;
			userData.isSelf = self;
			userData.showHidden = self || isAdmin;
			userData.groups = Array.isArray(results.groups) && results.groups.length ? results.groups[0] : [];
			userData.disableSignatures = meta.config.disableSignatures !== undefined && parseInt(meta.config.disableSignatures, 10) === 1;
			userData['email:confirmed'] = !!parseInt(userData['email:confirmed'], 10);
			userData.profile_links = results.profile_links;
			userData.status = require('../socket.io').isUserOnline(userData.uid) ? (userData.status || 'online') : 'offline';
			userData.banned = parseInt(userData.banned, 10) === 1;
			userData.website = validator.escape(userData.website);
			userData.websiteLink = !userData.website.startsWith('http') ? 'http://' + userData.website : userData.website;
			userData.websiteName = userData.website.replace(validator.escape('http://'), '').replace(validator.escape('https://'), '');
			userData.followingCount = parseInt(userData.followingCount, 10) || 0;
			userData.followerCount = parseInt(userData.followerCount, 10) || 0;

			userData.username = validator.escape(userData.username);
			userData.email = validator.escape(userData.email);
			userData.fullname = validator.escape(userData.fullname);
			userData.location = validator.escape(userData.location);
			userData.signature = validator.escape(userData.signature);
			userData.aboutme = validator.escape(userData.aboutme || '');

			callback(null, userData);
		});
	});
}

accountsController.getUserByUID = function(req, res, next) {
	var uid = req.params.uid ? req.params.uid : 0;

	async.parallel({
		settings: async.apply(user.getSettings, uid),
		userData: async.apply(user.getUserData, uid)
	}, function(err, results) {
		if (err) {
			return next(err);
		}

		if (!results.userData) {
			return helpers.notFound(req, res);
		}

		results.userData.email = results.settings.showemail ? results.userData.email : undefined;
		results.userData.fullname = results.settings.showfullname ? results.userData.fullname : undefined;

		res.json(results.userData);
	});
};

accountsController.getAccount = function(req, res, next) {
	var lowercaseSlug = req.params.userslug.toLowerCase();

	if (req.params.userslug !== lowercaseSlug) {
		if (res.locals.isAPI) {
			req.params.userslug = lowercaseSlug;
		} else {
			return res.redirect(nconf.get('relative_path') + '/user/' + lowercaseSlug);
		}
	}

	getUserDataByUserSlug(req.params.userslug, req.uid, function (err, userData) {
		if (err) {
			return next(err);
		}

		if (!userData) {
			return helpers.notFound(req, res);
		}

		if (req.uid !== parseInt(userData.uid, 10)) {
			user.incrementUserFieldBy(userData.uid, 'profileviews', 1);
		}

		async.parallel({
			isFollowing: function(next) {
				user.isFollowing(req.uid, userData.theirid, next);
			},
			posts: function(next) {
				posts.getPostSummariesFromSet('uid:' + userData.theirid + ':posts', req.uid, 0, 9, next);
			},
			signature: function(next) {
				posts.parseSignature(userData, req.uid, next);
			},
			aboutme: function(next) {
				if (userData.aboutme) {
					plugins.fireHook('filter:parse.raw', userData.aboutme, next);
				} else {
					next();
				}
			}
		}, function(err, results) {
			if(err) {
				return next(err);
			}

			if (parseInt(meta.config['reputation:disabled'], 10) === 1) {
				delete userData.reputation;
			}

			userData.posts = results.posts.posts.filter(function (p) {
				return p && parseInt(p.deleted, 10) !== 1;
			});
			userData.aboutme = results.aboutme;
			userData.nextStart = results.posts.nextStart;
			userData.isFollowing = results.isFollowing;

			if (!userData.profileviews) {
				userData.profileviews = 1;
			}

			plugins.fireHook('filter:user.account', {userData: userData, uid: req.uid}, function(err, data) {
				if (err) {
					return next(err);
				}
				res.render('account/profile', data.userData);
			});
		});
	});
};

accountsController.getFollowing = function(req, res, next) {
	getFollow('account/following', 'following', req, res, next);
};

accountsController.getFollowers = function(req, res, next) {
	getFollow('account/followers', 'followers', req, res, next);
};

function getFollow(tpl, name, req, res, next) {
	var userData;

	async.waterfall([
		function(next) {
			getUserDataByUserSlug(req.params.userslug, req.uid, next);
		},
		function(data, next) {
			userData = data;
			if (!userData) {
				return helpers.notFound(req, res);
			}
			var method = name === 'following' ? 'getFollowing' : 'getFollowers';
			user[method](userData.uid, 0, 49, next);
		}
	], function(err, users) {
		if (err) {
			return next(err);
		}

		userData.users = users;
		userData.nextStart = 50;
		userData.title = '[[pages:' + tpl + ', ' + userData.username + ']]';

		res.render(tpl, userData);
	});
}

accountsController.getFavourites = function(req, res, next) {
	getFromUserSet('account/favourites', 'favourites', posts.getPostSummariesFromSet, 'posts', req, res, next);
};

accountsController.getPosts = function(req, res, next) {
	getFromUserSet('account/posts', 'posts', posts.getPostSummariesFromSet, 'posts', req, res, next);
};

accountsController.getWatchedTopics = function(req, res, next) {
	getFromUserSet('account/watched', 'followed_tids', topics.getTopicsFromSet, 'topics', req, res, next);
};

accountsController.getTopics = function(req, res, next) {
	getFromUserSet('account/topics', 'topics', topics.getTopicsFromSet, 'topics', req, res, next);
};

accountsController.getGroups = function(req, res, next) {
	accountsController.getBaseUser(req.params.userslug, req.uid, function(err, userData) {
		if (err) {
			return next(err);
		}

		if (!userData) {
			return helpers.notFound(req, res);
		}

		groups.getUserGroups([userData.uid], function(err, groupsData) {
			if (err) {
				return next(err);
			}

			userData.groups = groupsData[0];
			userData.groups.forEach(groups.escapeGroupData);
			userData.title = '[[pages:account/groups, ' + userData.username + ']]';
			res.render('account/groups', userData);
		});
	});
};

function getFromUserSet(tpl, set, method, type, req, res, next) {
	async.parallel({
		settings: function(next) {
			user.getSettings(req.uid, next);
		},
		userData: function(next) {
			accountsController.getBaseUser(req.params.userslug, req.uid, next);
		}
	}, function(err, results) {
		if (err) {
			return next(err);
		}
		var userData = results.userData;
		if (!userData) {
			return helpers.notFound(req, res);
		}

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

accountsController.accountEdit = function(req, res, next) {
	var userData;
	async.waterfall([
		function(next) {
			getUserDataByUserSlug(req.params.userslug, req.uid, next);
		},
		function(data, next) {
			userData = data;
			db.getObjectField('user:' + userData.uid, 'password', next);
		}
	], function(err, password) {
		if (err) {
			return next(err);
		}

		userData.hasPassword = !!password;
		userData.title = '[[pages:account/edit, ' + userData.username + ']]';
		res.render('account/edit', userData);
	});
};

accountsController.accountSettings = function(req, res, next) {
	var userData;
	async.waterfall([
		function(next) {
			accountsController.getBaseUser(req.params.userslug, req.uid, next);
		},
		function(_userData, next) {
			userData = _userData;
			if (!userData) {
				return helpers.notFound(req, res);
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
			plugins.fireHook('filter:user.settings', {settings: results.settings, customSettings: [], uid: req.uid}, next);
		},
		function(data, next) {
			userData.customSettings = data.customSettings;
			userData.disableEmailSubscriptions = parseInt(meta.config.disableEmailSubscriptions, 10) === 1;
			next();
		}
	], function(err) {
		if (err) {
			return next(err);
		}

		userData.dailyDigestFreqOptions = [
			{value: 'off', name: '[[user:digest_off]]', selected: 'off' === userData.settings.dailyDigestFreq},
			{value: 'day', name: '[[user:digest_daily]]', selected: 'day' === userData.settings.dailyDigestFreq},
			{value: 'week', name: '[[user:digest_weekly]]', selected: 'week' === userData.settings.dailyDigestFreq},
			{value: 'month', name: '[[user:digest_monthly]]', selected: 'month' === userData.settings.dailyDigestFreq}
		];


		userData.bootswatchSkinOptions = [
			{
				"name": "Default",
				"value": "default"
			},
			{
				"name": "Cerulean",
				"value": "cerulean"
			},
			{
				"name": "Cosmo",
				"value": "cosmo"
			},
			{
				"name": "Cyborg",
				"value": "cyborg"
			},
			{
				"name": "Darkly",
				"value": "darkly"
			},
			{
				"name": "Flatly",
				"value": "flatly"
			},
			{
				"name": "Journal",
				"value": "journal"
			},
			{
				"name": "Lumen",
				"value": "lumen"
			},
			{
				"name": "Paper",
				"value": "paper"
			},
			{
				"name": "Readable",
				"value": "readable"
			},
			{
				"name": "Sandstone",
				"value": "sandstone"
			},
			{
				"name": "Simplex",
				"value": "simplex"
			},
			{
				"name": "Slate",
				"value": "slate"
			},
			{
				"name": "Spacelab",
				"value": "spacelab"
			},
			{
				"name": "Superhero",
				"value": "superhero"
			},
			{
				"name": "United",
				"value": "united"
			},
			{
				"name": "Yeti",
				"value": "yeti"
			}
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
		fs.unlink(userPhoto.path);
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
			title: '[[pages:notifications]]'
		});
	});
};

accountsController.getChats = function(req, res, next) {
	if (parseInt(meta.config.disableChat) === 1) {
		return helpers.notFound(req, res);
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
			return next(err);
		}

		//Remove entries if they were already present as a followed contact
		if (results.contacts && results.contacts.length) {
			var contactUids = results.contacts.map(function(contact) {
					return parseInt(contact.uid, 10);
				});

			results.recentChats.users = results.recentChats.users.filter(function(chatObj) {
				return contactUids.indexOf(parseInt(chatObj.uid, 10)) === -1;
			});
		}

		if (!req.params.userslug) {
			return res.render('chats', {
				chats: results.recentChats.users,
				nextStart: results.recentChats.nextStart,
				contacts: results.contacts,
				allowed: true,
				title: '[[pages:chats]]'
			});
		}

		async.waterfall([
			async.apply(user.getUidByUserslug, req.params.userslug),
			function(toUid, next) {
				if (!toUid || parseInt(toUid, 10) === parseInt(req.user.uid, 10)) {
					return helpers.notFound(req, res);
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
				return next(err);
			}

			res.render('chats', {
				chats: results.recentChats.users,
				nextStart: results.recentChats.nextStart,
				contacts: results.contacts,
				meta: data.toUser,
				messages: data.messages,
				allowed: data.allowed,
				title: '[[pages:chat, ' + data.toUser.username + ']]'
			});
		});
	});
};

module.exports = accountsController;
