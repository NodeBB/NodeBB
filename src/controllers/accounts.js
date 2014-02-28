var accountsController = {},
	user = require('./../user'),
	posts = require('./../posts');


function userNotFound(res) {
	if (res.locals.isAPI) {
		return res.json(404, {
			error: 'User not found!'
		});
	} else {
		return res.render('404', {
			error: 'User not found!'
		});
	} 
}

function userNotAllowed(res) {
	if (res.locals.isAPI) {
		return res.json(403, {
			error: 'Not allowed.'
		});
	} else {
		return res.render('403', {
			error: 'Not allowed.'
		});
	} 
}

function getUserDataByUserSlug(userslug, callerUID, callback) {
	user.getUidByUserslug(userslug, function(err, uid) {
		if(err || !uid) {
			return callback(err || new Error('invalid-user'));
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
			}
		}, function(err, results) {
			if(err || !results.userData) {
				return callback(err || new Error('invalid-user'));
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

			function canSeeEmail() {
				return ;
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

			userData.disableSignatures = meta.config.disableSignatures !== undefined && parseInt(meta.config.disableSignatures, 10) === 1;

			userData.followingCount = results.followStats.followingCount;
			userData.followerCount = results.followStats.followerCount;

			callback(null, userData);
		});
	});
}

accountsController.getAccount = function(req, res, next) {
	var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

	getUserDataByUserSlug(req.params.userslug, callerUID, function (err, userData) {
		if(err) {
			return next(err);
		}

		if(!userData) {
			return res.json(404, {
				error: 'User not found!'
			});
		}

		user.isFollowing(callerUID, userData.theirid, function (isFollowing) {
			posts.getPostsByUid(callerUID, userData.theirid, 0, 9, function (err, userPosts) {
				if(err) {
					return next(err);
				}

				userData.posts = userPosts.posts.filter(function (p) {
					return p && parseInt(p.deleted, 10) !== 1;
				});

				userData.isFollowing = isFollowing;

				if (!userData.profileviews) {
					userData.profileviews = 1;
				}

				if (callerUID !== parseInt(userData.uid, 10) && callerUID) {
					user.incrementUserFieldBy(userData.uid, 'profileviews', 1);
				}

				postTools.parse(userData.signature, function (err, signature) {
					userData.signature = signature;

					if (res.locals.isAPI) {
						res.json({});
					} else {
						res.render('account', {});
					};
				});
			});
		});
	});
};

accountsController.getFollowing = function(req, res, next) {
	var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

	getUserDataByUserSlug(req.params.userslug, callerUID, function (err, userData) {
		if(err) {
			return next(err);
		}

		if (userData) {
			user.getFollowing(userData.uid, function (err, followingData) {
				if(err) {
					return next(err);
				}
				userData.following = followingData;
				userData.followingCount = followingData.length;
				
				if (res.locals.isAPI) {
					res.json(userData);
				} else {
					res.render('following', userData);
				}
			});

		} else {
			return userNotFound();
		}
	});
};

accountsController.getFollowers = function(req, res, next) {
	var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

	getUserDataByUserSlug(req.params.userslug, callerUID, function (err, userData) {
		if(err) {
			return next(err);
		}

		if (userData) {
			user.getFollowers(userData.uid, function (err, followersData) {
				if(err) {
					return next(err);
				}
				userData.followers = followersData;
				userData.followersCount = followersData.length;
				
				if (res.locals.isAPI) {
					res.json(userData);
				} else {
					res.render('followers', userData);
				}
			});
		} else {
			return userNotFound();
		}
	});
};

accountsController.getFavourites = function(req, res, next) {
	var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

	user.getUidByUserslug(req.params.userslug, function (err, uid) {
		if (!uid) {
			return userNotFound();
		}

		if (parseInt(uid, 10) !== callerUID) {
			return userNotAllowed();
		}

		user.getUserFields(uid, ['username', 'userslug'], function (err, userData) {
			if (err) {
				return next(err);
			}

			if (!userData) {
				return userNotFound();
			}

			posts.getFavourites(uid, 0, 9, function (err, favourites) {
				if (err) {
					return next(err);
				}

				userData.theirid = uid;
				userData.yourid = callerUID;
				userData.posts = favourites.posts;
				userData.nextStart = favourites.nextStart;

				if (res.locals.isAPI) {
					res.json(userData);
				} else {
					res.render('favourites', userData);
				}
			});
		});
	});
};

accountsController.getPosts = function(req, res, next) {
	var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

	user.getUidByUserslug(req.params.userslug, function (err, uid) {
		if (!uid) {
			return userNotFound();
		}

		user.getUserFields(uid, ['username', 'userslug'], function (err, userData) {
			if (err) {
				return next(err);
			}

			if (!userData) {
				return userNotFound();
			}

			posts.getPostsByUid(callerUID, uid, 0, 19, function (err, userPosts) {
				if (err) {
					return next(err);
				}
				userData.uid = uid;
				userData.theirid = uid;
				userData.yourid = callerUID;
				userData.posts = userPosts.posts;
				userData.nextStart = userPosts.nextStart;

				if (res.locals.isAPI) {
					res.json(userData);
				} else {
					res.render('accountposts', userData);
				}
			});
		});
	});
};

accountsController.accountEdit = function(req, res, next) {
	var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

	getUserDataByUserSlug(req.params.userslug, callerUID, function (err, userData) {
		if(err) {
			return next(err);
		}
		
		if (res.locals.isAPI) {
			res.json(userData);
		} else {
			res.render('accountedit', userData);
		}
	});
};

accountsController.accountSettings = function(req, res, next) {
	var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

	user.getUidByUserslug(req.params.userslug, function(err, uid) {
		if (err) {
			return next(err);
		}

		if (!uid) {
			return userNotFound();
		}

		if (parseInt(uid, 10) !== callerUID) {
			return userNotAllowed();
		}

		plugins.fireHook('filter:user.settings', [], function(err, settings) {
			if (err) {
				return next(err);
			}

			user.getUserFields(uid, ['username', 'userslug'], function(err, userData) {
				if (err) {
					return next(err);
				}

				if(!userData) {
					return userNotFound();
				}
				userData.yourid = req.user.uid;
				userData.theirid = uid;
				userData.settings = settings;
				
				if (res.locals.isAPI) {
					res.json(userData);
				} else {
					res.render('accountsettings', userData);
				}
			});
		});

	});

	
};



module.exports = accountsController;