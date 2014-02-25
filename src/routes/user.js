var fs = require('fs'),
	path = require('path'),
	winston = require('winston'),
	nconf = require('nconf'),
	async= require('async'),
	imagemagick = require('node-imagemagick'),

	user = require('./../user'),
	posts = require('./../posts'),
	postTools = require('../postTools'),
	utils = require('./../../public/src/utils'),
	templates = require('./../../public/src/templates'),
	meta = require('./../meta'),
	plugins = require('./../plugins'),
	image = require('./../image'),
	file = require('./../file'),
	db = require('./../database');

(function (User) {
	User.createRoutes = function (app) {

		app.namespace('/users', function () {
			var routes = ['', '/latest', '/sort-posts', '/sort-reputation', '/online', '/search'];

			function createRoute(routeName) {
				app.get(routeName, function (req, res) {

					if(!req.user && !!parseInt(meta.config.privateUserInfo, 10)) {
						return res.redirect('/403');
					}

					app.build_header({
						req: req,
						res: res
					}, function (err, header) {
						res.send(header + app.create_route("users" + routeName, "users") + templates['footer']);
					});
				});
			}

			for (var i=0; i<routes.length; ++i) {
				createRoute(routes[i]);
			}
		});

		app.namespace('/user', function () {

			function createRoute(routeName, path, templateName, access) {

				function isAllowed(req, res, next) {
					var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

					if (!callerUID && !!parseInt(meta.config.privateUserInfo, 10)) {
						return res.redirect('/403');
					}

					user.getUidByUserslug(req.params.userslug, function (err, uid) {
						if (err) {
							return next(err);
						}

						if (!uid) {
							return res.redirect('/404');
						}

						if (parseInt(uid, 10) === callerUID) {
							return next();
						}

						if (req.path.indexOf('/edit') !== -1) {
							user.isAdministrator(callerUID, function(err, isAdmin) {
								if(err) {
									return next(err);
								}

								if(!isAdmin) {
									return res.redirect('/403');
								}

								next();
							});
						} else if (req.path.indexOf('/settings') !== -1 || req.path.indexOf('/favourites') !== -1) {
							res.redirect('/403')
						} else {
							next();
						}
					});
				}

				app.get(routeName, isAllowed, function(req, res, next) {
					app.build_header({
						req: req,
						res: res
					}, function (err, header) {
						if(err) {
							return next(err);
						}
						res.send(header + app.create_route('user/' + req.params.userslug + path, templateName) + templates['footer']);
					});
				});
			}

			createRoute('/:userslug', '', 'account');
			createRoute('/:userslug/following', '/following', 'following');
			createRoute('/:userslug/followers', '/followers', 'followers');
			createRoute('/:userslug/favourites', '/favourites', 'favourites');
			createRoute('/:userslug/posts', '/posts', 'accountposts');
			createRoute('/:userslug/edit', '/edit', 'accountedit');
			createRoute('/:userslug/settings', '/settings', 'accountsettings');

			app.post('/uploadpicture', function (req, res) {
				if (!req.user) {
					return res.json(403, {
						error: 'Not allowed!'
					});
				}

				var uploadSize = parseInt(meta.config.maximumProfileImageSize, 10) || 256;
				if (req.files.userPhoto.size > uploadSize * 1024) {
					return res.send({
						error: 'Images must be smaller than ' + uploadSize + ' kb!'
					});
				}

				var allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
				if (allowedTypes.indexOf(req.files.userPhoto.type) === -1) {
					return res.send({
						error: 'Allowed image types are png, jpg and gif!'
					});
				}

				var extension = path.extname(req.files.userPhoto.name);
				if (!extension) {
					return res.send({
						error: 'Error uploading file! Error : Invalid extension!'
					});
				}

				var updateUid = req.user.uid;

				async.waterfall([
					function(next) {
						image.resizeImage(req.files.userPhoto.path, extension, 128, 128, next);
					},
					function(next) {
						image.convertImageToPng(req.files.userPhoto.path, extension, next);
					},
					function(next) {
						try {
							var params = JSON.parse(req.body.params);
							if(parseInt(updateUid, 10) === parseInt(params.uid, 10)) {
								return next();
							}

							user.isAdministrator(req.user.uid, function(err, isAdmin) {
								if(err) {
									return next(err);
								}

								if(!isAdmin) {
									return res.json(403, {
										error: 'Not allowed!'
									});
								}
								updateUid = params.uid;
								next();
							});
						} catch(err) {
							next(err);
						}
					}
				], function(err, result) {

					function done(err, image) {
						fs.unlink(req.files.userPhoto.path);
						if(err) {
							return res.send({error: err.message});
						}

						user.setUserField(updateUid, 'uploadedpicture', image.url);
						user.setUserField(updateUid, 'picture', image.url);
						res.json({
							path: image.url
						});
					}

					if(err) {
						return res.send({error:err.message});
					}

					if(plugins.hasListeners('filter:uploadImage')) {
						return plugins.fireHook('filter:uploadImage', req.files.userPhoto, done);
					}

					var convertToPNG = parseInt(meta.config['profile:convertProfileImageToPNG'], 10);
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
			});
		});

		function isAllowed(req, res, next) {
			if(!req.user && !!parseInt(meta.config.privateUserInfo, 10)) {
				return res.json(403, 'not-allowed');
			}
			next();
		}

		app.get('/api/user/:userslug/following', isAllowed, getUserFollowing);
		app.get('/api/user/:userslug/followers', isAllowed, getUserFollowers);
		app.get('/api/user/:userslug/edit', isAllowed, getUserEdit);
		app.get('/api/user/:userslug/settings', isAllowed, getUserSettings);
		app.get('/api/user/:userslug/favourites', isAllowed, getUserFavourites);
		app.get('/api/user/:userslug/posts', isAllowed, getUserPosts);
		app.get('/api/user/uid/:uid', isAllowed, getUserData);
		app.get('/api/user/:userslug', isAllowed, getUserProfile);

		app.get('/api/users', isAllowed, getOnlineUsers);
		app.get('/api/users/sort-posts', isAllowed, getUsersSortedByPosts);
		app.get('/api/users/sort-reputation', isAllowed, getUsersSortedByReputation);
		app.get('/api/users/latest', isAllowed, getUsersSortedByJoinDate);
		app.get('/api/users/online', isAllowed, getOnlineUsers);
		app.get('/api/users/search', isAllowed, getUsersForSearch);


		function getUserProfile(req, res, next) {
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
							res.json(userData);
						});
					});
				});
			});
		}

		function getUserData(req, res, next) {
			var uid = req.params.uid ? req.params.uid : 0;

			user.getUserData(uid, function(err, userData) {
				res.json(userData);
			});
		}

		function getUserPosts(req, res, next) {
			var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

			user.getUidByUserslug(req.params.userslug, function (err, uid) {
				if (!uid) {
					return res.json(404, {
						error: 'User not found!'
					});
				}

				user.getUserFields(uid, ['username', 'userslug'], function (err, userData) {
					if (err) {
						return next(err);
					}

					if (!userData) {
						return res.json(404, {
							error: 'User not found!'
						});
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

						res.json(userData);
					});
				});
			});
		}

		function getUserFavourites(req, res, next) {
			var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

			user.getUidByUserslug(req.params.userslug, function (err, uid) {
				if (!uid) {
					return res.json(404, {
						error: 'User not found!'
					});
				}

				if (parseInt(uid, 10) !== callerUID) {
					return res.json(403, {
						error: 'Not allowed!'
					});
				}

				user.getUserFields(uid, ['username', 'userslug'], function (err, userData) {
					if (err) {
						return next(err);
					}

					if (!userData) {
						return res.json(404, {
							error: 'User not found!'
						});
					}

					posts.getFavourites(uid, 0, 9, function (err, favourites) {
						if (err) {
							return next(err);
						}

						userData.theirid = uid;
						userData.yourid = callerUID;
						userData.posts = favourites.posts;
						userData.nextStart = favourites.nextStart;

						res.json(userData);
					});
				});
			});
		}

		function getUserSettings(req, res, next) {
			var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

			user.getUidByUserslug(req.params.userslug, function(err, uid) {
				if (err) {
					return next(err);
				}

				if (!uid) {
					return res.json(404, {
						error: 'User not found!'
					});
				}

				if (parseInt(uid, 10) !== callerUID) {
					return res.json(403, {
						error: 'Not allowed!'
					});
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
							return res.json(404, {
								error: 'User not found!'
							});
						}
						userData.yourid = req.user.uid;
						userData.theirid = uid;
						userData.settings = settings;
						res.json(userData);
					});
				});

			});
		}

		function getUserEdit(req, res, next) {
			var callerUID = req.user ? parseInt(req.user.uid, 10) : 0;

			getUserDataByUserSlug(req.params.userslug, callerUID, function (err, userData) {
				if(err) {
					return next(err);
				}
				res.json(userData);
			});
		}

		function getUserFollowers(req, res, next) {
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
						res.json(userData);
					});
				} else {
					res.json(404, {
						error: 'User not found!'
					});
				}
			});
		}

		function getUserFollowing(req, res, next) {
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
						res.json(userData);
					});

				} else {
					res.json(404, {
						error: 'User not found!'
					});
				}
			});
		}

		function getUsersSortedByJoinDate(req, res) {
			user.getUsers('users:joindate', 0, 49, function (err, data) {
				res.json({
					search_display: 'none',
					loadmore_display: 'block',
					users: data,
					show_anon: 'hide'
				});
			});
		}

		function getUsersSortedByPosts(req, res) {
			user.getUsers('users:postcount', 0, 49, function (err, data) {
				res.json({
					search_display: 'none',
					loadmore_display: 'block',
					users: data,
					show_anon: 'hide'
				});
			});
		}

		function getUsersSortedByReputation(req, res) {
			user.getUsers('users:reputation', 0, 49, function (err, data) {
				res.json({
					search_display: 'none',
					loadmore_display: 'block',
					users: data,
					show_anon: 'hide'
				});
			});
		}

		function getOnlineUsers(req, res, next) {
			var	websockets = require('../socket.io');

			user.getUsers('users:online', 0, 49, function (err, data) {
				if(err) {
					return next(err);
				}
				var onlineUsers = [];

				uid = 0;
				if (req.user) {
					uid = req.user.uid;
				}

				user.isAdministrator(uid, function (err, isAdministrator) {
					if(err) {
						return next(err);
					}

					if (!isAdministrator) {
						data = data.filter(function(item) {
							return item.status !== 'offline';
						});
					}

					function iterator(userData, next) {
						var online = websockets.isUserOnline(userData.uid);
						if(!online) {
							db.sortedSetRemove('users:online', userData.uid);
							return next(null);
						}

						onlineUsers.push(userData);
						next(null);
					}

					var anonymousUserCount = websockets.getOnlineAnonCount();

					async.each(data, iterator, function(err) {
						res.json({
							search_display: 'none',
							loadmore_display: 'block',
							users: onlineUsers,
							anonymousUserCount: anonymousUserCount,
							show_anon: anonymousUserCount?'':'hide'
						});
					});
				});
			});
		}

		function getUsersForSearch(req, res) {
			res.json({
				search_display: 'block',
				loadmore_display: 'none',
				users: [],
				show_anon: 'hide'
			});
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
	};

}(exports));
