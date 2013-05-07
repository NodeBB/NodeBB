var express = require('express'),
	WebServer = express(),
	server = require('http').createServer(WebServer),
	RedisStore = require('connect-redis')(express),
	path = require('path'),
    config = require('../config.js'),
    redis = require('redis'),
	redisServer = redis.createClient(config.redis.port, config.redis.host, config.redis.options),
	passport = require('passport'),
	passportLocal = require('passport-local').Strategy,
	passportTwitter = require('passport-twitter').Strategy,
	passportGoogle = require('passport-google-oauth').OAuth2Strategy,
	passportFacebook = require('passport-facebook').Strategy,
	user = require('./user.js'),
	utils = require('./utils.js'),
	login_strategies = [];

passport.use(new passportLocal(function(user, password, next) {
	global.modules.user.loginViaLocal(user, password, function(login) {
		if (login.status === 'ok') next(null, login.user);
		else next(null, false, login);
	});
}));

if (config.twitter && config.twitter.key && config.twitter.key.length > 0 && config.twitter.secret.length > 0) {
	passport.use(new passportTwitter({
		consumerKey: config.twitter.key,
		consumerSecret: config.twitter.secret,
		callbackURL: config.url + 'auth/twitter/callback'
	}, function(token, tokenSecret, profile, done) {
		global.modules.user.loginViaTwitter(profile.id, profile.username, function(err, user) {
			if (err) { return done(err); }
			done(null, user);
		});
	}));

	login_strategies.push('twitter');
}

if (config.google && config.google.id.length > 0 && config.google.secret.length > 0) {
	passport.use(new passportGoogle({
		clientID: config.google.id,
		clientSecret: config.google.secret,
		callbackURL: config.url + 'auth/google/callback'
	}, function(accessToken, refreshToken, profile, done) {
		global.modules.user.loginViaGoogle(profile.id, profile.displayName, profile.emails[0].value, function(err, user) {
			if (err) { return done(err); }
			done(null, user);
		});
	}));

	login_strategies.push('google');
}

if (config.facebook && config.facebook.app_id.length > 0 && config.facebook.secret.length > 0) {
	passport.use(new passportFacebook({
		clientID: config.facebook.app_id,
		clientSecret: config.facebook.secret,
		callbackURL: config.url + 'auth/facebook/callback'
	}, function(accessToken, refreshToken, profile, done) {
		global.modules.user.loginViaFacebook(profile.id, profile.displayName, profile.emails[0].value, function(err, user) {
			if (err) { return done(err); }
			done(null, user);
		});
	}));

	login_strategies.push('facebook');
}

passport.serializeUser(function(user, done) {
	done(null, user.uid);
});

passport.deserializeUser(function(uid, done) {
	done(null, {
		uid: uid
	});
});

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
	app.use(passport.initialize());
	app.use(passport.session());
	app.use(function(req, res, next) {
		// Don't bother with session handling for API requests
		if (/^\/api\//.test(req.url)) return next();

		if (req.user && req.user.uid) {
			global.modules.user.session_ping(req.sessionID, req.user.uid);
		}

		// (Re-)register the session as active
		global.modules.user.active.register(req.sessionID);

		next();
	});
	
	// Dunno wtf this does
	//	app.use(express.logger({ format: '\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms' }));
	// Useful if you want to use app.put and app.delete (instead of app.post all the time)
	//	app.use(express.methodOverride());


	app.get('/403', function(req, res) {
		res.send(templates['header'] + templates['403'] + templates['footer']);
	});



	// Basic Routes (entirely client-side parsed, goal is to move the rest of the crap in this file into this one section)
	(function() {
		var routes = ['', 'login', 'register', 'account', 'latest', 'popular', 'active'];

		for (var i=0, ii=routes.length; i<ii; i++) {
			(function(route) {
				
				app.get('/' + route, function(req, res) {
					
					if ((route === 'login' || route ==='register') && (req.user && req.user.uid > 0)) {
						res.redirect('/account');
						return;
					}
					
					res.send(templates['header'] + '<script>templates.ready(function(){ajaxify.go("' + route + '");});</script>' + templates['footer']);
				});
			}(routes[i]));
		}
	}());
	
	// Complex Routes
	app.get('/topic/:topic_id/:slug?', function(req, res) {
		res.send(templates['header'] + '<script>templates.ready(function(){ajaxify.go("' + 'topic/' + req.params.topic_id + '");});</script>' + templates['footer']);
	});

	app.get('/category/:category_id/:slug?', function(req, res) {
		res.send(templates['header'] + '<script>templates.ready(function(){ajaxify.go("' + 'category/' + req.params.category_id + '");});</script>' + templates['footer']);
	});

	app.get('/confirm/:code', function(req, res) {
		res.send(templates['header'] + '<script>templates.ready(function(){ajaxify.go("' + 'confirm/' + req.params.code + '");});</script>' + templates['footer']);
	});

	// These functions are called via ajax once the initial page is loaded to populate templates with data
	function api_method(req, res) {
		switch(req.params.method) {
			case 'home' :
					global.modules.categories.get(function(data) {
						res.send(JSON.stringify(data));
					});
				break;
			case 'login' :
					var data = {},
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
			case 'topic' :
					global.modules.posts.get(function(data) {
						res.send(JSON.stringify(data));
					}, req.params.id, (req.user) ? req.user.uid : 0);
				break;
			case 'category' :
					global.modules.topics.get(function(data) {
						res.send(JSON.stringify(data));
					}, req.params.id);
				break;
			case 'latest' :
					global.modules.topics.get(function(data) {
						res.send(JSON.stringify(data));
					});
				break;
			case 'popular' :
					global.modules.topics.get(function(data) {
						res.send(JSON.stringify(data));
					});
				break;
			case 'active' :
					global.modules.topics.get(function(data) {
						res.send(JSON.stringify(data));
					});
				break;
			case 'users' : 
					get_account_fn(req, res, function(userData) {
						res.send(JSON.stringify(userData));
					});
				break;
			case 'confirm':
					global.modules.user.email.confirm(req.params.id, function(data) {
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
	app.get('/api/:method/:id*', api_method);

	app.post('/login', passport.authenticate('local', {
		successRedirect: '/',
		failureRedirect: '/login'
	}));

	app.get('/logout', function(req, res) {
		console.log('info: [Auth] Session ' + res.sessionID + ' logout (uid: ' + global.uid + ')');
		global.modules.user.logout(req.sessionID, function(logout) {
			req.logout();
			res.send(templates['header'] + templates['logout'] + templates['footer']);
		});
	});

	if (login_strategies.indexOf('twitter') !== -1) {
		app.get('/auth/twitter', passport.authenticate('twitter'));

		app.get('/auth/twitter/callback', passport.authenticate('twitter', {
			successRedirect: '/',
			failureRedirect: '/login'
		}));
	}

	if (login_strategies.indexOf('google') !== -1) {
		app.get('/auth/google', passport.authenticate('google', { scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email' }));

		app.get('/auth/google/callback', passport.authenticate('google', {
			successRedirect: '/',
			failureRedirect: '/login'
		}));
	}

	if (login_strategies.indexOf('facebook') !== -1) {
		app.get('/auth/facebook', passport.authenticate('facebook', { scope: 'email' }));

		app.get('/auth/facebook/callback', passport.authenticate('facebook', {
			successRedirect: '/',
			failureRedirect: '/login'
		}));
	}

	app.get('/reset/:code', function(req, res) {
		res.send(templates['header'] + templates['reset_code'].parse({ reset_code: req.params.code }) + templates['footer']);
	});

	app.get('/reset', function(req, res) {
		res.send(templates['header'] + templates['reset'] + templates['footer']);
	});

	app.get('/register', function(req, res) {
		res.send(templates['header'] + templates['register'] + templates['footer']);
	});

	app.post('/register', function(req, res) {
		global.modules.user.create(req.body.username, req.body.password, req.body.email, function(err, uid) {
			if (err === null) {
				req.login({
					uid: uid
				}, function() {
					res.redirect('/');
				});
			} else {
				res.redirect('/register');
			}
		});
	});

	app.get('/baristest', function(req, res) {
		/*user.getUserField(req.user.uid, 'email', function(data) {
			console.log(" I GOT FIELD " +data);
		});*/
/*		user.getUserData(req.user.uid, function(data) {
			console.log(" USER DATA : " + JSON.stringify(data));
		});*/
//		user.getUserFields(req.user.uid, ['email','username'], function(data) {
		/*user.getUserFields(req.user.uid, ['username','email'], function(data) {
			console.log(" I GOT FIELDS " +JSON.stringify(data));
		});*/
		
		user.get_usernames_by_uids(["17","1"], function(data){
			console.log("I GOT "+JSON.stringify(data));
			
		});
	});

	//to baris, move this into account.js or sth later - just moved this out here for you to utilize client side tpl parsing
	//I didn't want to change too much so you should probably sort out the params etc
	function get_account_fn(req, res, callback) {

 		if (req.user === undefined) 
 			return res.redirect('/403');
	
		var requestedUserId = req.user.uid;

		if(req.params.id != req.user.uid)
			requestedUserId = req.params.id;

		user.getUserData(requestedUserId, function(data) {
			if(data)
			{
				data.joindate = utils.relativeTime(data.joindate);
				
				callback({user:data});
			}
			else
				callback({user:{}});
		});
	}

	
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
		// Render user list
		res.send('User list');
	});

	app.get('/users/:uid', handleUserProfile);
	app.get('/users/:uid/:username*', handleUserProfile);
	

	function handleUserProfile(req, res) {
		
		if(req.params.uid == 0) {
			res.send("User doesn't exist!");
			return;
		}

		user.getUserData(req.params.uid, function(data) {
			if(data) {
				if(req.url.indexOf(data.username) == -1)
					res.redirect(301, '/users/'+req.params.uid+'/'+data.username);
				else
					res.send(templates['header'] + '<script>templates.ready(function(){ajaxify.go("users/' + req.params.uid +'/'+data.username + '");});</script>' + templates['footer']);
			}
			else
				res.send("User doesn't exist!");			
		});
	}

	app.get('/test', function(req, res) {
		global.modules.posts.get(function(data) {
			res.send('<pre>' + JSON.stringify(data, null, 4) + '</pre>');
		}, 1, 1);
	});
}(WebServer));

server.listen(config.port);
global.server = server;