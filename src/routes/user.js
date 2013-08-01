var user = require('./../user.js'),
	posts = require('./../posts.js'),
	postTools = require('../postTools'),
	fs = require('fs'),
	utils = require('./../../public/src/utils.js'),
	path = require('path'),
	marked = require('marked');

(function(User) {
	User.create_routes = function(app) {
		
		app.get('/uid/:uid', function(req, res) {
		
			if(!req.params.uid)
				return res.redirect('/404');
			
			user.getUserData(req.params.uid, function(data) {
				if(data) {
					res.send(data);
				} else {
					res.json(404, {error:"User doesn't exist!"});
				}
			});
			
		});

		app.get('/users', function(req, res) {
			app.build_header({ req: req, res: res }, function(err, header) {
				res.send(header + app.create_route("users", "users") + templates['footer']);
			});
		});
		
		app.get('/users-latest', function(req, res) {
			app.build_header({ req: req, res: res }, function(err, header) {
				res.send(header + app.create_route("users-latest", "users") + templates['footer']);
			});
		});
		
		app.get('/users-sort-posts', function(req, res) {
			app.build_header({ req: req, res: res }, function(err, header) {
				res.send(header + app.create_route("users-sort-posts", "users") + templates['footer']);
			});
		});
		
		app.get('/users-sort-reputation', function(req, res) {
			app.build_header({ req: req, res: res }, function(err, header) {
				res.send(header + app.create_route("users-sort-reputation", "users") + templates['footer']);
			});
		});
		
		app.get('/users-search', function(req, res) {
			app.build_header({ req: req, res: res }, function(err, header) {
				res.send(header + app.create_route("users-search", "users") + templates['footer']);
			});
		});

		app.get('/users/:userslug', function(req, res, next) {

			if(!req.params.userslug) {
				next();
				return;
			}

			user.get_uid_by_userslug(req.params.userslug, function(uid) {
				if(!uid) {
					next();
					return;
				}
				
				app.build_header({ req: req, res: res }, function(err, header) {
					res.send(header + app.create_route('users/'+req.params.userslug, 'account')  + templates['footer']);
				});
			});		
		});
		
		app.get('/users/:userslug/edit', function(req, res) {

			if(!req.user)
				return res.redirect('/403');
			
			user.getUserField(req.user.uid, 'userslug', function(userslug) {
			
				if(req.params.userslug && userslug === req.params.userslug) {
					app.build_header({ req: req, res: res }, function(err, header) {
						res.send(header + app.create_route('users/'+req.params.userslug+'/edit','accountedit') + templates['footer']);
					});
				} else {
					return res.redirect('/404');
				}
			});	
		});

		app.get('/users/:userslug/settings', function(req, res) {

			if(!req.user)
				return res.redirect('/403');
			
			user.getUserField(req.user.uid, 'userslug', function(userslug) {
				if(req.params.userslug && userslug === req.params.userslug) {
					app.build_header({ req: req, res: res }, function(err, header) {
						res.send(header + app.create_route('users/'+req.params.userslug+'/settings','accountsettings') + templates['footer']);
					}) 
				} else {
					return res.redirect('/404');
				}
			});	
		});

		app.post('/users/uploadpicture', function(req, res) {
			if(!req.user)
				return res.redirect('/403');
			
			if(req.files.userPhoto.size > 262144) {
				res.send({
					error: 'Images must be smaller than 256kb!'
				});
				return;
			}
			
			var allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
			
			if(allowedTypes.indexOf(req.files.userPhoto.type) === -1) {
				res.send({
					error: 'Allowed image types are png, jpg and gif!'
				});
				return;	
			}

			user.getUserField(req.user.uid, 'uploadedpicture', function(oldpicture) {
				if(!oldpicture) {
					uploadUserPicture(req.user.uid, path.extname(req.files.userPhoto.name), req.files.userPhoto.path, res);
					return;
				}

				var absolutePath = path.join(global.configuration['ROOT_DIRECTORY'], global.nconf.get('upload_path'), path.basename(oldpicture));

				fs.unlink(absolutePath, function(err) {
					if(err) {        
						console.error('[%d] %s', Date.now(), + err);
					}

					uploadUserPicture(req.user.uid, path.extname(req.files.userPhoto.name), req.files.userPhoto.path, res);
				});
			});
		});
		
		function uploadUserPicture(uid, extension, tempPath, res) {
			if(!extension) {
				res.send({
					error: 'Error uploading file! Error : Invalid extension!'
				});
				return;
			}

			var filename = uid + '-profileimg' + extension;
			var uploadPath = path.join(global.configuration['ROOT_DIRECTORY'], global.nconf.get('upload_path'), filename);
			
			// @todo move to proper logging code - this should only be temporary
			console.log('Info: Attempting upload to: '+ uploadPath);
			
			var is = fs.createReadStream(tempPath);
			var os = fs.createWriteStream(uploadPath);

			is.on('end', function() {
				fs.unlinkSync(tempPath);

				var imageUrl = global.nconf.get('upload_url') + filename;

				user.setUserField(uid, 'uploadedpicture', imageUrl);
				user.setUserField(uid, 'picture', imageUrl);

				require('node-imagemagick').crop({
					srcPath: uploadPath,
  					dstPath: uploadPath,
					width: 128,
					height: 128
				}, function(err, stdout, stderr){
					if (err) {
						// @todo: better logging method; for now, send to stderr.
						// ideally, this should be happening in another process
						// to avoid poisoning the main process on error or allowing a significant problem
						// to crash the main process
						console.error('[%d] %s', Date.now(), + err);
					}

					res.json({ path: imageUrl });
				});

			});

			os.on('error', function(err) {
				console.error('[%d] %s', Date.now(), + err);
			});

			is.pipe(os);
		}

		app.get('/users/:userslug/following', function(req, res) {

			if(!req.user)
				return res.redirect('/403');
			
			user.get_uid_by_userslug(req.params.userslug, function(uid) {
				if(!uid) {
					res.redirect('/404');
					return;
				}
			
				app.build_header({ req: req, res: res }, function(err, header) {
					res.send(header + app.create_route('users/'+req.params.userslug+'/following','following') + templates['footer']);
				});
			});
		});
		
		app.get('/users/:userslug/followers', function(req, res) {

			if(!req.user)
				return res.redirect('/403');
			
			user.get_uid_by_userslug(req.params.userslug, function(uid) {
				if(!uid) {
					res.redirect('/404');
					return;
				}
				app.build_header({ req: req, res: res }, function(err, header) {
					res.send(header + app.create_route('users/'+req.params.userslug+'/followers','followers') + templates['footer']);
				});
			});
		});

		app.get('/api/users/:userslug/following', function(req, res) {
			var callerUID = req.user ? req.user.uid : 0;

			getUserDataByUserSlug(req.params.userslug, callerUID, function(userData) {
				if(userData) {
					user.getFollowing(userData.uid, function(followingData) {
						userData.following = followingData;
						userData.followingCount = followingData.length;
						res.json(userData);
					});
				
				} else {
					res.json(404, { error: 'User not found!' })	;
				}
			});
		});

		app.get('/api/users/:userslug/followers', function(req, res) {
			var callerUID = req.user ? req.user.uid : 0;
			
			getUserDataByUserSlug(req.params.userslug, callerUID, function(userData) {
				if(userData) {
					user.getFollowers(userData.uid, function(followersData) {
						userData.followers = followersData;
						userData.followersCount = followersData.length;
						res.json(userData);
					});
				} else {
					res.json(404, { error: 'User not found!' })	;
				}				
			});
		});

		app.get('/api/users/:userslug/edit', function(req, res) {
			var callerUID = req.user ? req.user.uid : 0;

			getUserDataByUserSlug(req.params.userslug, callerUID, function(userData) {
				res.json(userData);
			});
		});

		app.get('/api/users/:userslug/settings', function(req, res) {
			var callerUID = req.user ? req.user.uid : 0;

			user.get_uid_by_userslug(req.params.userslug, function(uid) {
				if(!uid) {
					res.json(404, { error: 'User not found!' })	;
					return;
				}
				
				if(uid !== callerUID || callerUID === "0") {
					res.json(403, { error: 'Not allowed!' });
					return;
				}
				user.getUserFields(uid, ['username','userslug','showemail'], function(userData) {
					if(userData) {
						if(userData.showemail && userData.showemail === "1")
							userData.showemail = "checked";
						else
							userData.showemail = "";
						res.json(userData);
					} else {
						res.json(404, { error: 'User not found!' })	;
					}				
				});
			});			
		});

		app.get('/api/users/:userslug', function(req, res) {
			var callerUID = req.user ? req.user.uid : 0;

			getUserDataByUserSlug(req.params.userslug, callerUID, function(userData) {
				if(userData) {
					user.isFollowing(callerUID, userData.theirid, function(isFollowing) {
						posts.getPostsByUid(userData.theirid, 0, 9, function(posts) {

							userData.posts = posts.filter(function(p) {return p.deleted !== "1";});
							userData.isFollowing = isFollowing;
							userData.signature = postTools.markdownToHTML(userData.signature, true);
							res.json(userData);
						});
					});
				} else {
					res.json(404, { error: 'User not found!' })	;
				}
			});						
		});

		app.get('/api/users', function(req, res) {
			user.getUserList(function(data) {
				data = data.sort(function(a, b) {
					return b.joindate - a.joindate;
				});
				res.json({ search_display: 'none', users: data });
			});
		});

		app.get('/api/users-sort-posts', getUsersSortedByPosts);
		app.get('/api/users-sort-reputation', getUsersSortedByReputation);
		app.get('/api/users-latest', getUsersSortedByJoinDate);
		app.get('/api/users-search', getUsersForSearch);
		
		function getUsersSortedByPosts(req, res) {
			user.getUserList(function(data) {
				data = data.sort(function(a, b) {
					return b.postcount - a.postcount;
				});
				res.json({ search_display: 'none', users:data });
			});
		}

		function getUsersSortedByReputation(req, res) {
			user.getUserList(function(data) {
				data = data.sort(function(a, b) {
					return b.reputation - a.reputation;
				});
				res.json({ search_display: 'none', users:data });
			});
		}

		function getUsersSortedByJoinDate(req, res) {
			user.getUserList(function(data) {
				data = data.sort(function(a, b) {
					return b.joindate - a.joindate;
				});
				res.json({ search_display: 'none', users:data });
			});
		}
	
		function getUsersForSearch(req, res) {		
			res.json({ search_display: 'block', users: [] });
		}

		function getUserDataByUserSlug(userslug, callerUID, callback) {
			user.get_uid_by_userslug(userslug, function(uid) {
				
				if(uid === null) {
					callback(null);
					return;
				}
						
				user.getUserData(uid, function(data) {
					if(data) {
						data.joindate = utils.relativeTime(data.joindate);

						if(!data.birthday) {
							data.age = '';
						} else {
							data.age = new Date().getFullYear() - new Date(data.birthday).getFullYear();
						}
						
						function canSeeEmail() {
							return callerUID === uid || (data.email && (data.showemail && data.showemail === "1"));
						}

						if(!canSeeEmail()) 
							data.email = "";

						if(callerUID === uid && (!data.showemail || data.showemail === "0"))
							data.emailClass = "";
						else 
							data.emailClass = "hide";


						data.uid = uid;
						data.yourid = callerUID;
						data.theirid = uid;

						user.getFollowingCount(uid, function(followingCount) {
							user.getFollowerCount(uid, function(followerCount) {
								data.followingCount = followingCount;
								data.followerCount = followerCount;
								callback(data);
							});
						});
					} else {
						callback(null);
					}
				});
				
			});
		}

	};

}(exports));
