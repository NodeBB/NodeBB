
var user = require('./../user.js'),
	posts = require('./../posts.js'),
	fs = require('fs'),
	utils = require('./../../public/src/utils.js'),
	path = require('path'),
	marked = require('marked');

(function(User) {
	User.create_routes = function(app) {
		
		app.get('/uid/:uid', function(req, res) {
		
			if(!req.params.uid)
				return res.redirect('/404');
			
			user.getUserData(req.params.uid, function(data){
				if(data)
					res.send(data);
				else
					res.send("User doesn't exist!");
			});
			
		});

		app.get('/users', function(req, res) {
			user.getUserList(function(data) {
				res.send(app.build_header(res) + app.create_route("users", "users") + templates['footer']);
			});
		});

		app.get('/users/:userslug', function(req, res) {

			if(!req.params.userslug) {
				res.send("User doesn't exist!");
				return;
			}

			user.get_uid_by_userslug(req.params.userslug, function(uid) {
				if(!uid) {
					res.redirect('/404');
					return;
				}
				
				user.getUserData(uid, function(userdata) {
						if(userdata) {
							res.send(app.build_header(res) + app.create_route('users/'+userdata.userslug, 'account')  + templates['footer']);
						}
						else {
							res.redirect('/404');
						}			
				});
			});		
		});
		
		app.get('/users/:userslug/edit', function(req, res){
				
			if(!req.user)
				return res.redirect('/403');
			
			user.getUserField(req.user.uid, 'userslug', function(userslug) {
			
				if(req.params.userslug && userslug === req.params.userslug)
					res.send(app.build_header(res) + app.create_route('users/'+req.params.userslug+'/edit','accountedit') + templates['footer']);
				else
					return res.redirect('/404');
			});	
		});

		app.post('/users/doedit', function(req, res){

			if(!req.user)
				return res.redirect('/403');
			
			if(req.user.uid != req.body.uid) {
				return res.redirect('/');
			}
			
			user.updateProfile(req.user.uid, req.body, function(data) {
				res.send(data);	
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
			var type = req.files.userPhoto.type;
			
			if(allowedTypes.indexOf(type) === -1) {
				res.send({
					error: 'Allowed image types are png, jpg and gif!'
				});
				return;	
			}

			user.getUserField(req.user.uid, 'uploadedpicture', function(oldpicture) {

				if(!oldpicture) {
					uploadUserPicture(req.user.uid, req.files.userPhoto.name, req.files.userPhoto.path, res);
					return;
				}

				var absolutePath = path.join(global.configuration['ROOT_DIRECTORY'], config.upload_path, path.basename(oldpicture));
				
				fs.unlink(absolutePath, function(err) {
					if(err) {				
						console.log(err);
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
			var uploadPath = path.join(global.configuration['ROOT_DIRECTORY'], config.upload_path, filename);
			
			console.log('Info: Attempting upload to: '+ uploadPath);
			
			var is = fs.createReadStream(tempPath);
			var os = fs.createWriteStream(uploadPath);

			is.on('end', function() {
				fs.unlinkSync(tempPath);

				var imageUrl = config.upload_url + filename;

				res.send({
					path: imageUrl
				});

				user.setUserField(uid, 'uploadedpicture', imageUrl);
				user.setUserField(uid, 'picture', imageUrl);

				var im = require('node-imagemagick');

				im.resize({
					srcPath: uploadPath,
					dstPath: uploadPath,
					width: 128
				}, function(err, stdout, stderr) {
					if (err) {
						console.log(err);
					}
				});

			});

			os.on('error', function(err) {
				console.log(err);
			});

			is.pipe(os);
		}
		

		app.post('/users/changepicture', function(req, res){
			if(!req.user)
				return res.redirect('/403');
			
			if(req.user.uid != req.body.uid)
				return res.redirect('/');
				
			var type = req.body.type;
			if(type == 'gravatar') {	
				user.getUserField(req.user.uid, 'gravatarpicture', function(gravatar){
					user.setUserField(req.user.uid, 'picture', gravatar);
				});
			}
			else if(type == 'uploaded') {
				user.getUserField(req.user.uid, 'uploadedpicture', function(uploadedpicture){
					user.setUserField(req.user.uid, 'picture', uploadedpicture);
				});
			}
			res.send({});
		});

		app.post('/users/follow', function(req, res){
			if(!req.user)
				return res.redirect('/403');
			
			if(req.user.uid == req.body.uid)
				return res.redirect('/');

			user.follow(req.user.uid, req.body.uid, function(data) {
				res.send({data:data});
			});
		});

		app.post('/users/unfollow', function(req, res){
			if(!req.user)
				return res.redirect('/403');
			
			if(req.user.uid == req.body.uid)
				return res.redirect('/');

			user.unfollow(req.user.uid, req.body.uid, function(data) {
				res.send({data:data});
			});
		});

		app.get('/users/:userslug/following', function(req, res) {

			if(!req.user)
				return res.redirect('/403');
			
			res.send(app.build_header(res) + app.create_route('users/'+req.params.userslug+'/following','following') + templates['footer']);
		});
		
		app.get('/users/:userslug/followers', function(req, res) {

			if(!req.user)
				return res.redirect('/403');
			
			res.send(app.build_header(res) + app.create_route('users/'+req.params.userslug+'/followers','followers') + templates['footer']);
		});

		function api_method(req, res) {
			
			var callerUID = req.user?req.user.uid : 0;

			if (!req.params.section && !req.params.userslug) {
				
				user.getUserList(function(data) {
					res.json({users:data});
				});
			}
			else if(String(req.params.section).toLowerCase() === 'following') {
				
				getUserDataByUserSlug(req.params.userslug, callerUID, function(userData) {
					
					user.getFollowing(userData.uid, function(followingData){
						userData.following = followingData;
						userData.followingCount = followingData.length;
						res.json(userData);
					});
				});
			}
			else if(String(req.params.section).toLowerCase() === 'followers') {
				
				getUserDataByUserSlug(req.params.userslug, callerUID, function(userData) {
					
					user.getFollowers(userData.uid, function(followersData){
						userData.followers = followersData;
						userData.followersCount = followersData.length;
						res.json(userData);
					});
				});
			}
			else if (String(req.params.section).toLowerCase() === 'edit') {
				getUserDataByUserSlug(req.params.userslug, callerUID, function(userData) {
					res.json(userData);
				});
			} else {
				getUserDataByUserSlug(req.params.userslug, callerUID, function(userData) {
					
					user.isFollowing(callerUID, userData.theirid, function(isFollowing) {
						
						posts.getPostsByUid(userData.theirid, function(posts) {
							userData.posts = posts;
							userData.isFollowing = isFollowing;
						
							userData.signature = marked(userData.signature || '');
						
							res.json(userData);
						});
					});
					
				});						
			}
		
		}

		app.get('/api/users/:userslug?/:section?', api_method);

		function getUserDataByUserSlug(userslug, callerUID, callback) {
		
			user.get_uid_by_userslug(userslug, function(uid) {
		
				user.getUserData(uid, function(data) {
					if(data) {

						data.joindate = utils.relativeTime(data.joindate);

						if(!data.birthday)
							data.age = '';
						else
							data.age = new Date().getFullYear() - new Date(data.birthday).getFullYear();
						
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
					}
					else
						callback({});
				});
				
			});
		}
		


	};


}(exports));