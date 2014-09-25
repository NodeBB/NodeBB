"use strict";

var accountsController = {};

var fs = require('fs'),
	path = require('path'),
	winston = require('winston'),
	nconf = require('nconf'),
	async= require('async'),

	db = require('../database'),
	user = require('../user'),
	posts = require('../posts'),
	topics = require('../topics'),
	messaging = require('../messaging'),
	postTools = require('../postTools'),
	utils = require('../../public/src/utils'),
	meta = require('../meta'),
	plugins = require('../plugins'),
	languages = require('../languages'),
	image = require('../image'),
	file = require('../file'),
	websockets = require('../socket.io');

function userNotFound(res) {
	if (res.locals.isAPI) {
		res.json(404, 'user-not-found');
	} else {
		res.render('404', {
			error: 'User not found!'
		});
	}
}

function userNotAllowed(res) {
	if (res.locals.isAPI) {
		res.json(403, 'not-allowed');
	} else {
		res.render('403', {
			error: 'Not allowed.'
		});
	}
}

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
			followStats: function(next) {
				user.getFollowStats(uid, next);
			},
			ips: function(next) {
				user.getIPs(uid, 4, next);
			},
			profile_links: function(next) {
				plugins.fireHook('filter:user.profileLinks', [], next);
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
			if(userData.lastonline) {
				userData.lastonline = utils.toISOString(userData.lastonline);
			} else {
				userData.lastonline = userData.joindate;
			}

			if (!userData.birthday) {
				userData.age = '';
			} else {
				userData.age = Math.floor((new Date().getTime() - new Date(userData.birthday).getTime()) / 31536000000);
			}

			if (!(isAdmin || self || (userData.email && userSettings.showemail))) {
				userData.email = "";
			}

			if (self && !userSettings.showemail) {
				userData.emailClass = "";
			} else {
				userData.emailClass = "hide";
			}

			if (isAdmin || self) {
				userData.ips = results.ips;
			}

			userData.websiteName = userData.website.replace('http://', '').replace('https://', '');
			userData.banned = parseInt(userData.banned, 10) === 1;
			userData.uid = userData.uid;
			userData.yourid = callerUID;
			userData.theirid = userData.uid;
			userData.isSelf = parseInt(callerUID, 10) === parseInt(userData.uid, 10);
			userData.showSettings = userData.isSelf || isAdmin;
			userData.disableSignatures = meta.config.disableSignatures !== undefined && parseInt(meta.config.disableSignatures, 10) === 1;
			userData['email:confirmed'] = !!parseInt(userData['email:confirmed'], 10);
			userData.profile_links = results.profile_links;
			userData.status = !websockets.isUserOnline(userData.uid) ? 'offline' : userData.status;

			userData.followingCount = results.followStats.followingCount;
			userData.followerCount = results.followStats.followerCount;

			callback(null, userData);
		});
	});
}

accountsController.getUserByUID = function(req, res, next) {
	var uid = req.params.uid ? req.params.uid : 0;

	user.getUserData(uid, function(err, userData) {
		res.json(userData);
	});
};

accountsController.getAccount = function(req, res, next) {
	var lowercaseSlug = req.params.userslug.toLowerCase(),
		callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

	if (req.params.userslug !== lowercaseSlug) {
		if (res.locals.isAPI) {
			req.params.userslug = lowercaseSlug;
		} else {
			res.redirect(nconf.get('relative_path') + '/user/' + lowercaseSlug);
		}
	}

	getUserDataByUserSlug(req.params.userslug, callerUID, function (err, userData) {
		if(err) {
			return next(err);
		}

		if(!userData) {
			return userNotFound(res);
		}

		async.parallel({
			isFollowing: function(next) {
				user.isFollowing(callerUID, userData.theirid, next);
			},
			posts: function(next) {
				posts.getPostsByUid(callerUID, userData.theirid, 0, 9, next);
			},
			signature: function(next) {
				postTools.parse(userData.signature, next);
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

			userData.signature = results.signature;
			res.render('account/profile', userData);
		});
	});
};

accountsController.getFollowing = function(req, res, next) {
	getFollow('account/following', 'following', req, res, next);
};

accountsController.getFollowers = function(req, res, next) {
	getFollow('account/followers', 'followers', req, res, next);
};

function getFollow(route, name, req, res, next) {
	var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;
	var userData;

	async.waterfall([
		function(next) {
			getUserDataByUserSlug(req.params.userslug, callerUID, next);
		},
		function(data, next) {
			userData = data;
			if (!userData) {
				return userNotFound(res);
			}
			var method = name === 'following' ? 'getFollowing' : 'getFollowers';
			user[method](userData.uid, next);
		}
	], function(err, users) {
		if(err) {
			return next(err);
		}
		userData[name] = users;
		userData[name + 'Count'] = users.length;

		res.render(route, userData);
	});
}

accountsController.getFavourites = function(req, res, next) {
	var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

	getBaseUser(req.params.userslug, callerUID, function(err, userData) {
		if (err) {
			return next(err);
		}

		if (!userData) {
			return userNotFound(res);
		}

		if (parseInt(userData.uid, 10) !== callerUID) {
			return userNotAllowed(res);
		}

		posts.getFavourites(userData.uid, 0, 9, function (err, favourites) {
			if (err) {
				return next(err);
			}

			userData.posts = favourites.posts;
			userData.nextStart = favourites.nextStart;

			res.render('account/favourites', userData);
		});
	});
};

accountsController.getPosts = function(req, res, next) {
	var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

	getBaseUser(req.params.userslug, callerUID, function(err, userData) {
		if (err) {
			return next(err);
		}

		if (!userData) {
			return userNotFound(res);
		}

		posts.getPostsByUid(callerUID, userData.uid, 0, 19, function (err, userPosts) {
			if (err) {
				return next(err);
			}

			userData.posts = userPosts.posts;
			userData.nextStart = userPosts.nextStart;

			res.render('account/posts', userData);
		});
	});
};

accountsController.getTopics = function(req, res, next) {
	var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

	getBaseUser(req.params.userslug, callerUID, function(err, userData) {
		if (err) {
			return next(err);
		}

		if (!userData) {
			return userNotFound(res);
		}

		var set = 'uid:' + userData.uid + ':topics';
		topics.getTopicsFromSet(callerUID, set, 0, 19, function(err, userTopics) {
			if(err) {
				return next(err);
			}

			userData.topics = userTopics.topics;
			userData.nextStart = userTopics.nextStart;

			res.render('account/topics', userData);
		});
	});
};

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
			results.user.showSettings = results.user.isSelf || results.isAdmin;
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
		userData.csrf = req.csrfToken();

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
			return userNotFound(res);
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

			userData.disableEmailSubscriptions = meta.config.disableEmailSubscriptions !== undefined && parseInt(meta.config.disableEmailSubscriptions, 10) === 1;

			res.render('account/settings', userData);
		});
	});
};

accountsController.uploadPicture = function (req, res, next) {
	var uploadSize = parseInt(meta.config.maximumProfileImageSize, 10) || 256;
	if (req.files.userPhoto.size > uploadSize * 1024) {
		fs.unlink(req.files.userPhoto.path);
		return res.json({
			error: 'Images must be smaller than ' + uploadSize + ' kb!'
		});
	}

	var allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
	if (allowedTypes.indexOf(req.files.userPhoto.type) === -1) {
		fs.unlink(req.files.userPhoto.path);
		return res.json({
			error: 'Allowed image types are png, jpg and gif!'
		});
	}

	var extension = path.extname(req.files.userPhoto.name);
	if (!extension) {
		fs.unlink(req.files.userPhoto.path);
		return res.json({
			error: 'Error uploading file! Error : Invalid extension!'
		});
	}

	var updateUid = req.user.uid;
	var imageDimension = parseInt(meta.config.profileImageDimension, 10) || 128;

	async.waterfall([
		function(next) {
			image.resizeImage(req.files.userPhoto.path, extension, imageDimension, imageDimension, next);
		},
		function(next) {
			if (parseInt(meta.config['profile:convertProfileImageToPNG'], 10) === 1) {
				image.convertImageToPng(req.files.userPhoto.path, extension, next);
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
					return userNotAllowed();
				}
				updateUid = uid;
				next();
			});
		}
	], function(err, result) {

		function done(err, image) {
			fs.unlink(req.files.userPhoto.path);
			if(err) {
				return res.json({error: err.message});
			}

			user.setUserFields(updateUid, {uploadedpicture: image.url, picture: image.url});

			res.json({
				path: image.url
			});
		}

		if (err) {
			fs.unlink(req.files.userPhoto.path);
			return res.json({error:err.message});
		}

		if(plugins.hasListeners('filter:uploadImage')) {
			return plugins.fireHook('filter:uploadImage', req.files.userPhoto, done);
		}

		var convertToPNG = parseInt(meta.config['profile:convertProfileImageToPNG'], 10) === 1;
		var filename = updateUid + '-profileimg' + (convertToPNG ? '.png' : extension);

		user.getUserField(updateUid, 'uploadedpicture', function (err, oldpicture) {
			if (!oldpicture) {
				file.saveFileToLocal(filename, req.files.userPhoto.path, done);
				return;
			}

			var absolutePath = path.join(nconf.get('base_dir'), nconf.get('upload_path'), path.basename(oldpicture));

			fs.unlink(absolutePath, function (err) {
				if (err) {
					winston.err(err);
				}

				file.saveFileToLocal(filename, req.files.userPhoto.path, done);
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
				contacts: results.contacts
			});
		}

		async.waterfall([
			async.apply(user.getUidByUserslug, req.params.userslug),
			function(toUid, next) {
				async.parallel({
					toUser: async.apply(user.getUserFields, toUid, ['uid', 'username']),
					messages: async.apply(messaging.getMessages, req.user.uid, toUid, 'day', false)
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
				messages: data.messages
			});
		});
	});
};

module.exports = accountsController;
