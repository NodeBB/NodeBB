var express = require('express'),
	WebServer = express(),
	server = require('http').createServer(WebServer),
	RedisStore = require('connect-redis')(express),
	path = require('path'),
    config = require('../config.js'),
    redis = require('redis'),
	redisServer = redis.createClient(config.redis.port, config.redis.host, config.redis.options),
	
	user = require('./user.js'),

	categories = require('./categories.js'),
	posts = require('./posts.js'),
	topics = require('./topics.js'),
	utils = require('./utils.js'),
	fs = require('fs'),
	admin = require('./routes/admin.js'),
	userRoute = require('./routes/user.js'),
	auth = require('./routes/authentication.js');


(function(app) {
	var templates = global.templates;

	// Middlewares
	app.use(express.favicon());	// 2 args: string path and object options (i.e. expire time etc)
	app.use(require('less-middleware')({ src: path.join(__dirname, '../', '/public') }));
	app.use(express.static(path.join(__dirname, '../', 'public')));
	app.use(express.bodyParser());	// Puts POST vars in request.body
	app.use(express.cookieParser());	// If you want to parse cookies (res.cookies)
	app.use(express.compress());
	app.use(express.session({
		store: new RedisStore({
			client: redisServer,
			ttl: 60*60*24*14
		}),
		secret: config.secret,
		key: 'express.sid'
	}));

	auth.initialize(app);

	app.use(function(req, res, next) {
		// Don't bother with session handling for API requests
		if (/^\/api\//.test(req.url)) return next();

		if (req.user && req.user.uid) {
			user.session_ping(req.sessionID, req.user.uid);
		}

		// (Re-)register the session as active
		user.active.register(req.sessionID);

		next();
	});
	
	auth.create_routes(app);
	admin.create_routes(app);
	userRoute.create_routes(app);


	app.create_route = function(url, tpl) { // to remove
		return '<script>templates.ready(function(){ajaxify.go("' + url + '", null, "' + tpl + '");});</script>';
	};


	// Basic Routes (entirely client-side parsed, goal is to move the rest of the crap in this file into this one section)
	(function() {
		var routes = ['', 'login', 'register', 'account', 'latest', 'popular', 'active', '403'];

		for (var i=0, ii=routes.length; i<ii; i++) {
			(function(route) {
				
				app.get('/' + route, function(req, res) {
					
					if ((route === 'login' || route ==='register') && (req.user && req.user.uid > 0)) {
						res.redirect('/account');
						return;
					}
					
					res.send(templates['header'] + app.create_route(route) + templates['footer']);
				});
			}(routes[i]));
		}
	}());
	
	// Complex Routes
	app.get('/topic/:topic_id/:slug?', function(req, res) {
		var topic_url = req.params.topic_id + (req.params.slug ? '/' + req.params.slug : '');
		res.send(templates['header'] + '<script>templates.ready(function(){ajaxify.go("topic/' + topic_url + '");});</script>' + templates['footer']);
	});

	app.get('/category/:category_id/:slug?', function(req, res) {
		var category_url = req.params.category_id + (req.params.slug ? '/' + req.params.slug : '');
		res.send(templates['header'] + '<script>templates.ready(function(){ajaxify.go("category/' + category_url + '");});</script>' + templates['footer']);
	});

	app.get('/confirm/:code', function(req, res) {
		res.send(templates['header'] + '<script>templates.ready(function(){ajaxify.go("confirm/' + req.params.code + '");});</script>' + templates['footer']);
	});
	
	// These functions are called via ajax once the initial page is loaded to populate templates with data
	function api_method(req, res) {		
		switch(req.params.method) {
			case 'home' :
					categories.get(function(data) {
						res.send(JSON.stringify(data));
					});
				break;
			case 'login' :
					var data = {},
						login_strategies = auth.get_login_strategies(),
						num_strategies = login_strategies.length;

					if (num_strategies == 0) {
						data = {
							'login_window:spansize': 'span12',
							'alternate_logins:display': 'none'
						};	
					} else {
						data = {
							'login_window:spansize': 'span6',
							'alternate_logins:display': 'block'
						}
						for (var i=0, ii=num_strategies; i<ii; i++) {
							data[login_strategies[i] + ':display'] = 'active';
						}
					}

					res.send(JSON.stringify(data));
				break;
			case 'register' :
					var data = {},
						login_strategies = auth.get_login_strategies(),
						num_strategies = login_strategies.length;

					if (num_strategies == 0) {
						data = {
							'register_window:spansize': 'span12',
							'alternate_logins:display': 'none'
						};	
					} else {
						data = {
							'register_window:spansize': 'span6',
							'alternate_logins:display': 'block'
						}
						for (var i=0, ii=num_strategies; i<ii; i++) {
							data[login_strategies[i] + ':display'] = 'active';
						}
					}

					res.send(JSON.stringify(data));
				break;
			case 'topic' :
					posts.get(function(data) {
						res.send(JSON.stringify(data));
					}, req.params.id, (req.user) ? req.user.uid : 0);
				break;
			case 'category' :
					topics.get(function(data) {
						res.send(JSON.stringify(data));
					}, req.params.id, (req.user) ? req.user.uid : 0);
				break;
			case 'latest' :
					topics.get(function(data) {
						res.send(JSON.stringify(data));
					});
				break;
			case 'popular' :
					topics.get(function(data) {
						res.send(JSON.stringify(data));
					});
				break;
			case 'active' :
					topics.get(function(data) {
						res.send(JSON.stringify(data));
					});
				break;
			case 'users' : 
					if (!req.params.section && !req.params.id) {
						get_users_fn(req, res, function(userData) {
							res.send(JSON.stringify(userData));
						});
					}
					else if (String(req.params.section).toLowerCase() === 'edit') {
						get_account_fn(req, res, function(userData) {
							res.send(JSON.stringify(userData));
						});
					} else {
						get_account_fn(req, res, function(userData) {
							res.send(JSON.stringify(userData));
						});						
					}
					
				break;
			case 'confirm':
					user.email.confirm(req.params.id, function(data) {
						if (data.status === 'ok') {
							res.send(JSON.stringify({
								'alert-class': 'alert-success',
								title: 'Email Confirmed',
								text: 'Thank you for vaidating your email. Your account is now fully activated.'
							}));
						} else {
							res.send(JSON.stringify({
								'alert-class': 'alert-error',
								title: 'An error occurred...',
								text: 'There was a problem validating your email address. Perhaps the code was invalid or has expired.'
							}));
						}
					});
				break;
			default :
				res.send('{}');
			break;
		}
	}

	app.get('/api/:method', api_method);
	app.get('/api/:method/:id', api_method);
	// ok fine MUST ADD RECURSION style. I'll look for a better fix in future but unblocking baris for this:
	app.get('/api/:method/:id/:section?', api_method);
	app.get('/api/:method/:id*', api_method);
	



// TODO move user related logic into another file vvvvvvvvvvvvvvvvvvvv

	app.post('/pictureupload', function(req, res) {
    	
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
			var filename = oldpicture.substr(index+1);

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
	

	app.post('/changeuserpicture', function(req, res){
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


	app.post('/edituser', function(req, res){

		if(!req.user)
			return res.redirect('/403');
		
		if(req.user.uid != req.body.uid)
			return res.redirect('/');
		
		user.updateProfile(req.user.uid, req.body);
		
		res.redirect('/');
	});
	

	//to baris, move this into account.js or sth later - just moved this out here for you to utilize client side tpl parsing
	//I didn't want to change too much so you should probably sort out the params etc
	function get_account_fn(req, res, callback) {
		
		var username = req.params.id;
		console.log("derp");
		user.get_uid_by_username(username, function(uid) {
	
			user.getUserData(uid, function(data) {
				if(data)
				{
					data.joindate = utils.relativeTime(data.joindate);
					data.age = new Date().getFullYear() - new Date(data.birthday).getFullYear();
					console.log(data.age);
					if(data.age === null)
						data.age = 0;
					data.uid = uid;
					
					data.yourid = (req.user)?req.user.uid : 0;
					data.theirid = uid;
					
					callback(data);
				}
				else
					callback({user:{}});
			});
			
		});
	}
	
	function get_users_fn(req, res, callback) {
		user.getUserList(function(data){
			callback({users:data});
		});
	}
	

	app.get('/users/:uid/edit', function(req, res){
		
		if(!req.user)
			return res.redirect('/403');
		
		user.getUserField(req.user.uid, 'username', function(username) {
		
			if(req.params.uid && username === req.params.uid)
				res.send(templates['header'] + app.create_route('users/'+req.params.uid+'/edit','accountedit') + templates['footer']);
			else
				return res.redirect('/403');
		});	
	});
	

	app.get('/test', function(req, res) {
		posts.getRawContent(11, function(post) {
			res.send(JSON.stringify(post));
		});
	});

// TODO move user related logic into another file ^^^^^^^^^^^^^^^^^^^^^^^
}(WebServer));

server.listen(config.port);
global.server = server;