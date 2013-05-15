

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

		app.get('/users/:username', function(req, res) {

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
			
			var is = fs.createReadStream(tempPath);
			var os = fs.createWriteStream(global.configuration['ROOT_DIRECTORY'] + uploadPath);

			is.on('end', function(){
 				fs.unlinkSync(tempPath);

				var imageUrl = config.upload_url + filename;
		 			
		        res.send({
					path: imageUrl
		        });
		            
		        user.setUserField(uid, 'uploadedpicture', imageUrl);
		        user.setUserField(uid, 'picture', imageUrl);

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

		app.post('/users/addfriend', function(req, res){
			if(!req.user)
				return res.redirect('/403');
			
			if(req.user.uid == req.body.uid)
				return res.redirect('/');

			user.addFriend(req.user.uid, req.body.uid, function(data) {
				res.send({data:data});
			});
		});

		app.post('/users/removefriend', function(req, res){
			if(!req.user)
				return res.redirect('/403');
			
			if(req.user.uid == req.body.uid)
				return res.redirect('/');

			user.removeFriend(req.user.uid, req.body.uid, function(data) {
				res.send({data:data});
			});
		});

		app.get('/users/:username/friends', function(req, res){

			if(!req.user)
				return res.redirect('/403');
			
			res.send(templates['header'] + app.create_route('users/'+req.params.username+'/friends','friends') + templates['footer']);
		});

		function api_method(req, res) {
			
			var callerUID = req.user?req.user.uid : 0;
	
			if (!req.params.section && !req.params.username) {
				
				user.getUserList(function(data){
					
					res.send(JSON.stringify({users:data}));
					
				});
			}
			else if(String(req.params.section).toLowerCase() === 'friends') {
				
				getUserDataByUserName(req.params.username, callerUID, function(userData) {
					
					user.getFriends(userData.uid, function(friendsData){
						userData.friends = friendsData;
						userData.friendCount = friendsData.length;
						res.send(JSON.stringify(userData));
					});
				});
			}
			else if (String(req.params.section).toLowerCase() === 'edit') {
				getUserDataByUserName(req.params.username, callerUID, function(userData) {
					res.send(JSON.stringify(userData));
				});
			} else {
				getUserDataByUserName(req.params.username, callerUID, function(userData) {
					user.isFriend(callerUID, userData.theirid, function(isFriend) {
						userData.isFriend = isFriend;
						res.send(JSON.stringify(userData));
					});
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