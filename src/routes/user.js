

var user = require('./../user.js'),
	fs = require('fs'),
	utils = require('./../utils.js'),
	config = require('../../config.js');


(function(User) {
	User.create_routes = function(app) {

		
		app.get('/uid/:uid', function(req, res) {
		
			if(!req.params.uid)
				return res.redirect('/403');
			
			user.getUserData(req.params.uid, function(data){
				if(data)
					res.send(data);
				else
					res.send("User doesn't exist!");
			});
			
		});

		app.get('/users', function(req, res) {

			user.getUserList(function(data) {

				res.send(templates['header'] + app.create_route("users", "users") + templates['footer']);

			});
			
		});

		app.get('/users/:username*', function(req, res) {
			if(!req.params.username) {
				res.send("User doesn't exist!");
				return;
			}

			user.get_uid_by_username(req.params.username, function(uid) {
				
				if(!uid) {
					res.redirect('/403');
					return;
				}
				
				user.getUserData(uid, function(data) {
					if(data) {
						res.send(templates['header'] + app.create_route('users/'+data.username, 'account')  + templates['footer']);
					}
					else {
						res.redirect('/403');
					}			
				});
			});		
		});
		
		app.get('/users/:username/edit', function(req, res){
				
			if(!req.user)
				return res.redirect('/403');
			
			user.getUserField(req.user.uid, 'username', function(username) {
			
				if(req.params.username && username === req.params.username)
					res.send(templates['header'] + app.create_route('users/'+req.params.username+'/edit','accountedit') + templates['footer']);
				else
					return res.redirect('/403');
			});	
		});

		app.post('/users/doedit', function(req, res){

			if(!req.user)
				return res.redirect('/403');
			
			if(req.user.uid != req.body.uid)
				return res.redirect('/');
			
			user.updateProfile(req.user.uid, req.body);
			
			res.redirect('/');
		});

		app.post('/users/uploadpicture', function(req, res) {
    	
			if(!req.user)
				return res.redirect('/403');
			
			if(req.files.userPhoto.size > 131072) {
				res.send({
					error: 'Images must be smaller than 128kb!'
				});
				return;
			}
			
			user.getUserField(req.user.uid, 'uploadedpicture', function(oldpicture) {

				if(!oldpicture) {
					uploadUserPicture(req.user.uid, req.files.userPhoto.name, req.files.userPhoto.path, res);
					return;
				}
				
				var index = oldpicture.lastIndexOf('/');
				var filename = oldpicture.substr(index + 1);

				var absolutePath = global.configuration['ROOT_DIRECTORY'] + config.upload_path + filename;

				fs.unlink(absolutePath, function(err) {
					if(err) {				
						console.log(err);
					}
					
					uploadUserPicture(req.user.uid, req.files.userPhoto.name, req.files.userPhoto.path, res);
					
				});
				
			});

		});
		
		function uploadUserPicture(uid, filename, tempPath, res) {

			if(!filename){
				res.send({
	                error: 'Error uploading file! Error : Invalid file name!'
				});
	            return;
			}
			
			filename = uid + '-' + filename;
			var uploadPath = config.upload_path + filename;
			
			console.log('trying to upload to : '+ global.configuration['ROOT_DIRECTORY'] + uploadPath);
			
			fs.rename(
				tempPath,
				global.configuration['ROOT_DIRECTORY'] + uploadPath,
				function(error) {
		            if(error) {
		            	console.log(error);
						res.send({
		                    error: 'Error uploading file!'
						});
		                return;
		            }
		 			
		 			var imageUrl = config.upload_url + filename;
		 			
		            res.send({
						path: imageUrl
		            });
		            
		            user.setUserField(uid, 'uploadedpicture', imageUrl);
		            user.setUserField(uid, 'picture', imageUrl);
		            
				}
	    	);
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

		app.post('/users/addfriend', function(req, res){
			if(!req.user)
				return res.redirect('/403');
			
			if(req.user.uid == req.body.uid)
				return res.redirect('/');

			user.addFriend(req.user.uid, req.body.uid, function(err, data) {
				if(err)
					res.send({error:err});
				else
					res.send(data);
			});
		});

		app.get('/users/:username/friends', function(req, res){
				
			if(!req.user)
				return res.redirect('/403');
			
			user.get_uid_by_username(req.params.username, function(uid) {
					user.getFriends(uid, function(data) {
						res.send(JSON.stringify(data, null, 0));
					});
				});
		});

		function api_method(req, res) {
			console.log("fail "+req.params.section);
			var callerUID = req.user?req.user.uid : 0;
	
			if (!req.params.section && !req.params.username) {
				
				user.getUserList(function(data){
					
					res.send(JSON.stringify({users:data}));
					
				});
			}
			else if(String(req.params.section).toLowerCase() === 'friends') {
				
			}
			else if (String(req.params.section).toLowerCase() === 'edit') {
				getUserDataByUserName(req.params.username, callerUID, function(userData) {
					res.send(JSON.stringify(userData));
				});
			} else {
				getUserDataByUserName(req.params.username, callerUID, function(userData) {
					res.send(JSON.stringify(userData));
				});						
			}
		
		}

		app.get('/api/users/:username?/:section?', api_method);



		function getUserDataByUserName(username, callerUID, callback) {
		
			user.get_uid_by_username(username, function(uid) {
		
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
						
						callback(data);
					}
					else
						callback({});
				});
				
			});
		}
		


	};


}(exports));