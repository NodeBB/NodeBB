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
	db = require('./../database');

(function (User) {
	User.createRoutes = function (app) {

		app.namespace('/users', function () {
			var routes = ['', '/latest', '/sort-posts', '/sort-reputation', '/online', '/search'];

			function createRoute(routeName) {
				app.get(routeName, function (req, res) {
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

			function createRoute(routeName, path, templateName) {
				app.get(routeName, function(req, res, next) {
					if (!req.params.userslug) {
						return next();
					}

					if (!req.user && path === '/favourites') {
						return res.redirect('/403');
					}

					user.getUidByUserslug(req.params.userslug, function (err, uid) {
						if(err) {
							return next(err);
						}

						if (!uid) {
							return res.redirect('/404');
						}

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
				})
			}

			createRoute('/:userslug', '', 'account');
			createRoute('/:userslug/following', '/following', 'following');
			createRoute('/:userslug/followers', '/followers', 'followers');
			createRoute('/:userslug/favourites', '/favourites', 'favourites');
			createRoute('/:userslug/posts', '/posts', 'accountposts');

			app.get('/:userslug/edit', function (req, res, next) {

				if (!req.user) {
					return res.redirect('/403');
				}

				user.getUserField(req.user.uid, 'userslug', function (err, userslug) {
					function done() {
						app.build_header({
							req: req,
							res: res
						}, function (err, header) {
							res.send(header + app.create_route('user/' + req.params.userslug + '/edit', 'accountedit') + templates['footer']);
						});
					}

					if(err || !userslug) {
						return next(err);
					}

					if (userslug === req.params.userslug) {
						return done();
					}

					user.isAdministrator(req.user.uid, function(err, isAdmin) {
						if(err) {
							return next(err);
						}

						if(!isAdmin) {
							return res.redirect('/403');
						}

						done();
					});
				});
			});

			app.get('/:userslug/settings', function (req, res) {

				if (!req.user)
					return res.redirect('/403');

				user.getUserField(req.user.uid, 'userslug', function (err, userslug) {
					if (req.params.userslug && userslug === req.params.userslug) {
						app.build_header({
							req: req,
							res: res
						}, function (err, header) {
							res.send(header + app.create_route('user/' + req.params.userslug + '/settings', 'accountsettings') + templates['footer']);
						})
					} else {
						return res.redirect('/404');
					}
				});
			});

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

				var convertToPNG = parseInt(meta.config['profile:convertProfileImageToPNG'], 10);
				var filename = req.user.uid + '-profileimg' + (convertToPNG ? '.png' : extension);

				async.waterfall([
					function(next) {
						image.resizeImage(req.files.userPhoto.path, extension, 128, 128, next);
					},
					function(next) {
						image.convertImageToPng(req.files.userPhoto.path, extension, next);
					}
				], function(err, result) {
					function done(err, image) {
						if(err) {
							return res.send({error: err.message});
						}

						user.setUserField(req.user.uid, 'uploadedpicture', image.url);
						user.setUserField(req.user.uid, 'picture', image.url);
						res.json({
							path: image.url
						});
					}

					if(err) {
						return res.send({error:err.message});
					}

					if(plugins.hasListeners('filter:uploadImage')) {
						plugins.fireHook('filter:uploadImage', {file: req.files.userPhoto.path, name: filename}, done);
					} else {

						user.getUserField(req.user.uid, 'uploadedpicture', function (err, oldpicture) {
							if (!oldpicture) {
								saveFileToLocal(filename, req.files.userPhoto.path, done);
								return;
							}

							var absolutePath = path.join(nconf.get('base_dir'), nconf.get('upload_path'), path.basename(oldpicture));

							fs.unlink(absolutePath, function (err) {
								if (err) {
									winston.err(err);
								}

								saveFileToLocal(filename, req.files.userPhoto.path, done);
							});
						});
					}
				});
			});
		});


		function saveFileToLocal(filename, tempPath, callback) {

			var uploadPath = path.join(nconf.get('base_dir'), nconf.get('upload_path'), filename);

			winston.info('Saving file '+ filename +' to : ' + uploadPath);

			var is = fs.createReadStream(tempPath);
			var os = fs.createWriteStream(uploadPath);

			is.on('end', function () {
				fs.unlinkSync(tempPath);

				callback(null, {url: nconf.get('upload_url') + filename});
			});

			os.on('error', function (err) {
				fs.unlinkSync(tempPath);
				winston.error(err.message);
			});

			is.pipe(os);
		}


		app.get('/api/user/:userslug/following', function (req, res, next) {
			var callerUID = req.user ? req.user.uid : '0';

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
		});

		app.get('/api/user/:userslug/followers', function (req, res, next) {
			var callerUID = req.user ? req.user.uid : '0';

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
		});

		app.get('/api/user/:userslug/edit', function (req, res, next) {
			var callerUID = req.user ? req.user.uid : '0';

			if(!parseInt(callerUID, 10)) {
				return res.json(403, {
					error: 'Not allowed!'
				});
			}

			getUserDataByUserSlug(req.params.userslug, callerUID, function (err, userData) {
				if(err) {
					return next(err);
				}
				res.json(userData);
			});
		});

		app.get('/api/user/:userslug/settings', function(req, res, next) {
			var callerUID = req.user ? req.user.uid : '0';

			user.getUidByUserslug(req.params.userslug, function(err, uid) {
				if (err) {
					return next(err);
				}

				if (!uid) {
					return res.json(404, {
						error: 'User not found!'
					});
				}

				if (uid != callerUID || callerUID == '0') {
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
		});

		app.get('/api/user/:userslug/favourites', function (req, res, next) {
			var callerUID = req.user ? req.user.uid : '0';

			user.getUidByUserslug(req.params.userslug, function (err, uid) {
				if (!uid) {
					return res.json(404, {
						error: 'User not found!'
					});
				}

				if (uid != callerUID || callerUID == '0') {
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
		});

		app.get('/api/user/:userslug/posts', function (req, res, next) {
			var callerUID = req.user ? req.user.uid : '0';

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
		});


		app.get('/api/user/uid/:uid', function(req, res, next) {
			var uid = req.params.uid ? req.params.uid : 0;

			user.getUserData(uid, function(err, userData) {
				res.json(userData);
			});
		});

		app.get('/api/user/:userslug', function (req, res, next) {
			var callerUID = req.user ? req.user.uid : '0';

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

						if (parseInt(callerUID, 10) !== parseInt(userData.uid, 10) && parseInt(callerUID, 0)) {
							user.incrementUserFieldBy(userData.uid, 'profileviews', 1);
						}

						postTools.parse(userData.signature, function (err, signature) {
							userData.signature = signature;
							res.json(userData);
						});
					});
				});

			});
		});

		app.get('/api/users', getOnlineUsers);
		app.get('/api/users/sort-posts', getUsersSortedByPosts);
		app.get('/api/users/sort-reputation', getUsersSortedByReputation);
		app.get('/api/users/latest', getUsersSortedByJoinDate);
		app.get('/api/users/online', getOnlineUsers);
		app.get('/api/users/search', getUsersForSearch);


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
			var userData;

			async.waterfall([
				function(next) {
					user.getUidByUserslug(userslug, next);
				},
				function(uid, next) {
					if (!uid) {
						return next(new Error('invalid-user'));
					}

					user.getUserData(uid, next);
				},
				function(data, next) {
					userData = data;
					if (!userData) {
						return callback(new Error('invalid-user'));
					}

					user.isAdministrator(callerUID, next);
				}
			], function(err, isAdmin) {
				if(err) {
					return callback(err);
				}

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
					return isAdmin || callerUID == userData.uid || (userData.email && (userData.showemail && parseInt(userData.showemail, 10) === 1));
				}

				if (!canSeeEmail()) {
					userData.email = "";
				}

				if (callerUID == userData.uid && (!userData.showemail || parseInt(userData.showemail, 10) === 0)) {
					userData.emailClass = "";
				} else {
					userData.emailClass = "hide";
				}

				userData.websiteName = userData.website.replace('http://', '').replace('https://', '');
				userData.banned = parseInt(userData.banned, 10) === 1;
				userData.uid = userData.uid;
				userData.yourid = callerUID;
				userData.theirid = userData.uid;

				userData.disableSignatures = meta.config.disableSignatures !== undefined && parseInt(meta.config.disableSignatures, 10) === 1;

				user.getFollowStats(userData.uid, function (err, followStats) {
					if(err) {
						return callback(err);
					}
					userData.followingCount = followStats.followingCount;
					userData.followerCount = followStats.followerCount;
					callback(null, userData);
				});
			});
		}

	};

}(exports));
