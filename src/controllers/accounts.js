"use strict";

var accountsController = {};

var fs = require('fs'),
	path = require('path'),
	winston = require('winston'),
	nconf = require('nconf'),
	async = require('async'),
	validator = require('validator'),

	db = require('../database'),
	user = require('../user'),
	posts = require('../posts'),
	topics = require('../topics'),
	groups = require('../groups'),
	messaging = require('../messaging'),
	postTools = require('../postTools'),
	utils = require('../../public/src/utils'),
	meta = require('../meta'),
	plugins = require('../plugins'),
	languages = require('../languages'),
	image = require('../image'),
	file = require('../file'),
	helpers = require('./helpers'),
	websockets = require('../socket.io');

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
			userData.isSelf = self;
			userData.showHidden = self || isAdmin;
			userData.groups = Array.isArray(results.groups) && results.groups.length ? results.groups[0] : [];
			userData.disableSignatures = meta.config.disableSignatures !== undefined && parseInt(meta.config.disableSignatures, 10) === 1;
			userData['email:confirmed'] = !!parseInt(userData['email:confirmed'], 10);
			userData.profile_links = results.profile_links;
			userData.status = websockets.isUserOnline(userData.uid) ? (userData.status || 'online') : 'offline';
			userData.banned = parseInt(userData.banned, 10) === 1;
			userData.websiteName = userData.website.replace(validator.escape('http://'), '').replace(validator.escape('https://'), '');
			userData.followingCount = parseInt(userData.followingCount, 10) || 0;
			userData.followerCount = parseInt(userData.followerCount, 10) || 0;

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

		results.userData.email = results.settings.showemail ? results.userData.email : undefined;
		results.userData.fullname = results.settings.showfullname ? results.userData.fullname : undefined;

		res.json(results.userData);
	});
};

accountsController.getAccount = function(req, res, next) {
	var lowercaseSlug = req.params.userslug.toLowerCase(),
		callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

	if (req.params.userslug !== lowercaseSlug) {
		if (res.locals.isAPI) {
			req.params.userslug = lowercaseSlug;
		} else {
			return res.redirect(nconf.get('relative_path') + '/user/' + lowercaseSlug);
		}
	}

	getUserDataByUserSlug(req.params.userslug, callerUID, function (err, userData) {
		if (err) {
			return next(err);
		}

		if (!userData) {
			return helpers.notFound(req, res);
		}

		if (callerUID !== parseInt(userData.uid, 10)) {
			user.incrementUserFieldBy(userData.uid, 'profileviews', 1);
		}

		async.parallel({
			isFollowing: function(next) {
				user.isFollowing(callerUID, userData.theirid, next);
			},
			posts: function(next) {
				posts.getPostsFromSet('uid:' + userData.theirid + ':posts', callerUID, 0, 9, next);
			},
			signature: function(next) {
				postTools.parseSignature(userData, callerUID, next);
			}
		}, function(err, results) {
			if(err) {
				return next(err);
			}

			userData.posts = results.posts.posts.filter(function (p) {
				return p && parseInt(p.deleted, 10) !== 1;
			});

			userData.nextStart = results.posts.nextStart;
			userData.isFollowing = results.isFollowing;

			if (!userData.profileviews) {
				userData.profileviews = 1;
			}

			plugins.fireHook('filter:user.account', {userData: userData, uid: callerUID}, function(err, data) {
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
	var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;
	var userData;

	async.waterfall([
		function(next) {
			getUserDataByUserSlug(req.params.userslug, callerUID, next);
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
		if(err) {
			return next(err);
		}

		userData.users = users;
		userData.nextStart = 50;

		res.render(tpl, userData);
	});
}

accountsController.getFavourites = function(req, res, next) {
	getFromUserSet('account/favourites', 'favourites', posts.getPostsFromSet, 'posts', req, res, next);
};

accountsController.getPosts = function(req, res, next) {
	getFromUserSet('account/posts', 'posts', posts.getPostsFromSet, 'posts', req, res, next);
};

accountsController.getWatchedTopics = function(req, res, next) {
	getFromUserSet('account/watched', 'followed_tids', topics.getTopicsFromSet, 'topics', req, res, next);
};

accountsController.getTopics = function(req, res, next) {
	getFromUserSet('account/topics', 'topics', topics.getTopicsFromSet, 'topics', req, res, next);
};


function getFromUserSet(tpl, set, method, type, req, res, next) {
	var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

	getBaseUser(req.params.userslug, callerUID, function(err, userData) {
		if (err) {
			return next(err);
		}

		if (!userData) {
			return helpers.notFound(req, res);
		}

		method('uid:' + userData.uid + ':' + set, callerUID, 0, 19, function(err, data) {
			if (err) {
				return next(err);
			}

			userData[type] = data[type];
			userData.nextStart = data.nextStart;

			res.render(tpl, userData);
		});
	});
}

function getBaseUser(userslug, callerUID, callback) {
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
}

accountsController.accountEdit = function(req, res, next) {
	var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;
	var userData;
	async.waterfall([
		function(next) {
			getUserDataByUserSlug(req.params.userslug, callerUID, next);
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

		res.render('account/edit', userData);
	});
};

accountsController.accountSettings = function(req, res, next) {
	var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

	getBaseUser(req.params.userslug, callerUID, function(err, userData) {
		if (err) {
			return next(err);
		}

		if (!userData) {
			return helpers.notFound(req, res);
		}

		async.parallel({
			settings: function(next) {
				plugins.fireHook('filter:user.settings', [], next);
			},
			languages: function(next) {
				languages.list(next);
			}
		}, function(err, results) {
			if (err) {
				return next(err);
			}

			userData.settings = results.settings;
			userData.languages = results.languages;

			userData.disableEmailSubscriptions = parseInt(meta.config.disableEmailSubscriptions, 10) === 1;

			res.render('account/settings', userData);
		});
	});
};

accountsController.uploadPicture = function (req, res, next) {
	var userPhoto = req.files.files[0];
	var uploadSize = parseInt(meta.config.maximumProfileImageSize, 10) || 256;

	if (userPhoto.size > uploadSize * 1024) {
		fs.unlink(userPhoto.path);
		return next(new Error('[[error:file-too-big, ' + uploadSize + ']]'));
	}

	var allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
	if (allowedTypes.indexOf(userPhoto.type) === -1) {
		fs.unlink(userPhoto.path);
		return next(new Error('[[error:invalid-image-type, ' + allowedTypes.join(', ') + ']]'));
	}

	var extension = path.extname(userPhoto.name);
	if (!extension) {
		fs.unlink(userPhoto.path);
		return next(new Error('[[error:invalid-image-extension]]'));
	}

	var updateUid = req.user ? req.user.uid : 0;
	var imageDimension = parseInt(meta.config.profileImageDimension, 10) || 128;

	async.waterfall([
		function(next) {
			image.resizeImage(userPhoto.path, extension, imageDimension, imageDimension, next);
		},
		function(next) {
			if (parseInt(meta.config['profile:convertProfileImageToPNG'], 10) === 1) {
				image.convertImageToPng(userPhoto.path, extension, next);
			} else {
				next();
			}
		},
		function(next) {
			user.getUidByUserslug(req.params.userslug, next);
		},
		function(uid, next) {
			if(parseInt(updateUid, 10) === parseInt(uid, 10)) {
				return next();
			}

			user.isAdministrator(req.user.uid, function(err, isAdmin) {
				if (err) {
					return next(err);
				}

				if (!isAdmin) {
					return helpers.notAllowed(req, res);
				}
				updateUid = uid;
				next();
			});
		}
	], function(err, result) {

		function done(err, image) {
			fs.unlink(userPhoto.path);
			if (err) {
				return res.json({error: err.message});
			}

			user.setUserFields(updateUid, {uploadedpicture: image.url, picture: image.url});

			res.json([{name: userPhoto.name, url: image.url}]);
		}

		if (err) {
			fs.unlink(userPhoto.path);
			return next(err);
		}

		if (plugins.hasListeners('filter:uploadImage')) {
			return plugins.fireHook('filter:uploadImage', {image: userPhoto, uid: updateUid}, done);
		}

		var convertToPNG = parseInt(meta.config['profile:convertProfileImageToPNG'], 10) === 1;
		var filename = updateUid + '-profileimg' + (convertToPNG ? '.png' : extension);

		user.getUserField(updateUid, 'uploadedpicture', function (err, oldpicture) {
			if (err) {
				return next(err);
			}
			if (!oldpicture) {
				file.saveFileToLocal(filename, 'profile', userPhoto.path, done);
				return;
			}

			var absolutePath = path.join(nconf.get('base_dir'), nconf.get('upload_path'), 'profile', path.basename(oldpicture));

			fs.unlink(absolutePath, function (err) {
				if (err) {
					winston.err(err);
				}

				file.saveFileToLocal(filename, 'profile', userPhoto.path, done);
			});
		});
	});
};

accountsController.getNotifications = function(req, res, next) {
	user.notifications.getAll(req.user.uid, 40, function(err, notifications) {
		if (err) {
			return next(err);
		}
		res.render('notifications', {
			notifications: notifications
		});
	});
};

accountsController.getChats = function(req, res, next) {
	if (parseInt(meta.config.disableChat) === 1) {
		return helpers.notFound(req, res);
	}
	async.parallel({
		contacts: async.apply(user.getFollowing, req.user.uid),
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
				allowed: true
			});
		}

		async.waterfall([
			async.apply(user.getUidByUserslug, req.params.userslug),
			function(toUid, next) {
				if (!toUid) {
					return helpers.notFound(req, res);
				}
				async.parallel({
					toUser: async.apply(user.getUserFields, toUid, ['uid', 'username']),
					messages: async.apply(messaging.getMessages, req.user.uid, toUid, 'recent', false),
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
				allowed: data.allowed
			});
		});
	});
};

module.exports = accountsController;
