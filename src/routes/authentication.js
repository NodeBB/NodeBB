(function(Auth) {
	var passport = require('passport'),
		passportLocal = require('passport-local').Strategy,
		nconf = require('nconf'),
		bcrypt = require('bcryptjs'),
		winston = require('winston'),

		meta = require('../meta'),
		user = require('../user'),
		plugins = require('../plugins'),
		utils = require('../../public/src/utils'),
		templates = require('./../../public/src/templates'),

		login_strategies = [];

	plugins.ready(function() {
		plugins.fireHook('filter:auth.init', login_strategies, function(err) {
			if (err) {
				winston.error('filter:auth.init - plugin failure');
			}

			Auth.createRoutes(Auth.app);
		});
	});

	Auth.initialize = function(app) {
		app.use(passport.initialize());
		app.use(passport.session());
	}


	Auth.get_login_strategies = function() {
		return login_strategies;
	}

	Auth.registerApp = function(app) {
		Auth.app = app;
	}

	Auth.createRoutes = function(app) {
		app.namespace(nconf.get('relative_path'), function () {
			app.post('/logout', function(req, res) {
				if (req.user && parseInt(req.user.uid, 10) > 0) {
					winston.info('[Auth] Session ' + req.sessionID + ' logout (uid: ' + req.user.uid + ')');

					var ws = require('../socket.io');
					ws.logoutUser(req.user.uid);

					req.logout();
				}

				res.send(200)
			});

			for (var i in login_strategies) {
				var strategy = login_strategies[i];
				app.get(strategy.url, passport.authenticate(strategy.name, {
					scope: strategy.scope
				}));

				app.get(strategy.callbackURL, passport.authenticate(strategy.name, {
					successRedirect: '/',
					failureRedirect: '/login'
				}));
			}

			app.get('/reset/:code', function(req, res) {
				app.build_header({
					req: req,
					res: res
				}, function(err, header) {
					res.send(header + app.create_route('reset/' + req.params.code) + templates['footer']);
				});
			});

			app.get('/reset', function(req, res) {
				app.build_header({
					req: req,
					res: res
				}, function(err, header) {
					res.send(header + app.create_route('reset') + templates['footer']);
				});
			});

			app.post('/login', function(req, res, next) {
				passport.authenticate('local', function(err, userData, info) {
					if (err) {
						return next(err);
					}

					if (!userData) {
						return res.json(403, info);
					}

					// Alter user cookie depending on passed-in option
					if (req.body.remember === 'true') {
						var duration = 1000*60*60*24*parseInt(meta.configs.loginDays || 14, 10);
						req.session.cookie.maxAge = duration;
						req.session.cookie.expires = new Date(Date.now() + duration);
					} else {
						req.session.cookie.maxAge = false;
						req.session.cookie.expires = false;
					}

					req.login({
						uid: userData.uid
					}, function() {
						if (userData.uid) {
							user.logIP(userData.uid, req.ip);
						}

						res.json(200, info);
					});
				})(req, res, next);
			});

			app.post('/register', function(req, res) {
				if(meta.config.allowRegistration !== undefined && parseInt(meta.config.allowRegistration, 10) === 0) {
					return res.send(403);
				}

				user.create({username: req.body.username, password: req.body.password, email: req.body.email, ip: req.ip}, function(err, uid) {
					if (err === null && uid) {
						req.login({
							uid: uid
						}, function() {

							require('../socket.io').emitUserCount();

							if(req.body.referrer)
								res.redirect(req.body.referrer);
							else
								res.redirect(nconf.get('relative_path') + '/');
						});
					} else {
						res.redirect(nconf.get('relative_path') + '/register');
					}
				});
			});
		});
	}

	Auth.login = function(username, password, next) {
		if (!username || !password) {
			return next(new Error('invalid-user'));
		}

		var userslug = utils.slugify(username);

		user.getUidByUserslug(userslug, function(err, uid) {
			if (err) {
				return next(err);
			}

			if(!uid) {
				// Even if a user doesn't exist, compare passwords anyway, so we don't immediately return
				return next(null, false, 'user doesn\'t exist');
			}

			user.getUserFields(uid, ['password', 'banned'], function(err, userData) {
				if (err) {
					return next(err);
				}

				if (!userData || !userData.password) {
					return next(new Error('invalid userdata or password'));
				}

				if (userData.banned && parseInt(userData.banned, 10) === 1) {
					return next(null, false, 'User banned');
				}

				bcrypt.compare(password, userData.password, function(err, res) {
					if (err) {
						winston.err(err.message);
						return next(new Error('bcrypt compare error'));
					}

					if (!res) {
						return next(null, false, 'invalid-password');
					}

					next(null, {
						uid: uid
					}, 'Authentication successful');
				});
			});
		});
	}

	passport.use(new passportLocal(Auth.login));

	passport.serializeUser(function(user, done) {
		done(null, user.uid);
	});

	passport.deserializeUser(function(uid, done) {
		done(null, {
			uid: uid
		});
	});
}(exports));