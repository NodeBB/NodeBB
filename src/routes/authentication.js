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

		login_strategies = [];

	passport.use(new passportLocal(function(user, password, next) {
		Auth.login(user, password, function(err, login) {
			if (!err) {
				next(null, login.user);
			} else {
				next(null, false, err);
			}
		});
	}));

	plugins.ready(function() {
		plugins.fireHook('filter:auth.init', login_strategies, function(err) {
			if (err) {
				winston.error('filter:auth.init - plugin failure');
			}

			Auth.createRoutes(Auth.app);
		});
	});

	passport.serializeUser(function(user, done) {
		done(null, user.uid);
	});

	passport.deserializeUser(function(uid, done) {
		done(null, {
			uid: uid
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
				if (req.user && req.user.uid > 0) {
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
				passport.authenticate('local', function(err, user, info) {
					if (err) {
						return next(err);
					}
					if (!user) {
						return res.send({
							success: false,
							message: info.message
						});
					}
					req.login({
						uid: user.uid
					}, function() {
						res.send({
							success: true,
							message: 'authentication succeeded'
						});
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
			return next({
				status: 'error',
				message: 'invalid-user'
			});
		} else {

			var userslug = utils.slugify(username);

			user.getUidByUserslug(userslug, function(err, uid) {
				if (err) {
					return next(new Error('redis-error'));
				} else if (uid == null) {
					return next(new Error('invalid-user'));
				}

				user.getUserFields(uid, ['password', 'banned'], function(err, userData) {
					if (err) return next(err);

					if (userData.banned && parseInt(userData.banned, 10) === 1) {
						return next({
							status: "error",
							message: "user-banned"
						});
					}

					bcrypt.compare(password, userData.password, function(err, res) {
						if (err) {
							winston.err(err.message);
							next(new Error('bcrypt compare error'));
							return;
						}

						if (res) {
							next(null, {
								user: {
									uid: uid
								}
							});
						} else {
							next(new Error('invalid-password'));
						}
					});
				});
			});
		}
	}
}(exports));