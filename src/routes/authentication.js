(function(Auth) {
	var passport = require('passport'),
		passportLocal = require('passport-local').Strategy,
		passportTwitter = require('passport-twitter').Strategy,
		passportGoogle = require('passport-google-oauth').OAuth2Strategy,
		passportFacebook = require('passport-facebook').Strategy,
		login_strategies = [],
		nconf = require('nconf'),
		meta = require('../meta'),
		user = require('../user'),
		winston = require('winston'),
		login_module = require('./../login.js');

	passport.use(new passportLocal(function(user, password, next) {
		login_module.loginViaLocal(user, password, function(err, login) {
			if (!err) next(null, login.user);
			else next(null, false, err);
		});
	}));

	if (meta.config['social:twitter:key'] && meta.config['social:twitter:secret']) {
		passport.use(new passportTwitter({
			consumerKey: meta.config['social:twitter:key'],
			consumerSecret: meta.config['social:twitter:secret'],
			callbackURL: nconf.get('url') + 'auth/twitter/callback'
		}, function(token, tokenSecret, profile, done) {
			login_module.loginViaTwitter(profile.id, profile.username, profile.photos, function(err, user) {
				if (err) {
					return done(err);
				}
				done(null, user);
			});
		}));

		login_strategies.push('twitter');
	}

	if (meta.config['social:google:id'] && meta.config['social:google:secret']) {
		passport.use(new passportGoogle({
			clientID: meta.config['social:google:id'],
			clientSecret: meta.config['social:google:secret'],
			callbackURL: nconf.get('url') + 'auth/google/callback'
		}, function(accessToken, refreshToken, profile, done) {
			login_module.loginViaGoogle(profile.id, profile.displayName, profile.emails[0].value, function(err, user) {
				if (err) {
					return done(err);
				}
				done(null, user);
			});
		}));

		login_strategies.push('google');
	}

	if (meta.config['social:facebook:app_id'] && meta.config['social:facebook:secret']) {
		passport.use(new passportFacebook({
			clientID: meta.config['social:facebook:app_id'],
			clientSecret: meta.config['social:facebook:secret'],
			callbackURL: nconf.get('url') + 'auth/facebook/callback'
		}, function(accessToken, refreshToken, profile, done) {
			login_module.loginViaFacebook(profile.id, profile.displayName, profile.emails[0].value, function(err, user) {
				if (err) {
					return done(err);
				}
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

	Auth.initialize = function(app) {
		app.use(passport.initialize());
		app.use(passport.session());
	}


	Auth.get_login_strategies = function() {
		return login_strategies;
	}

	Auth.create_routes = function(app) {

		app.get('/logout', function(req, res) {
			if (req.user && req.user.uid > 0) {
				winston.info('[Auth] Session ' + req.sessionID + ' logout (uid: ' + req.user.uid + ')');
				login_module.logout(req.sessionID, function(logout) {
					req.logout();
					app.build_header({
						req: req,
						res: res
					}, function(err, header) {
						res.send(header + templates['logout'] + templates['footer']);
					});
				});
			} else res.redirect('/');
		});

		if (login_strategies.indexOf('twitter') !== -1) {
			app.get('/auth/twitter', passport.authenticate('twitter'));

			app.get('/auth/twitter/callback', passport.authenticate('twitter', {
				successRedirect: '/',
				failureRedirect: '/login'
			}));
		}

		if (login_strategies.indexOf('google') !== -1) {
			app.get('/auth/google', passport.authenticate('google', {
				scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email'
			}));

			app.get('/auth/google/callback', passport.authenticate('google', {
				successRedirect: '/',
				failureRedirect: '/login'
			}));
		}

		if (login_strategies.indexOf('facebook') !== -1) {
			app.get('/auth/facebook', passport.authenticate('facebook', {
				scope: 'email'
			}));

			app.get('/auth/facebook/callback', passport.authenticate('facebook', {
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
			user.create(req.body.username, req.body.password, req.body.email, function(err, uid) {

				if (err === null && uid) {
					req.login({
						uid: uid
					}, function() {
						res.redirect(nconf.get('relative_path') + '/');
					});
				} else {
					res.redirect(nconf.get('relative_path') + '/register');
				}
			});
		});
	}
}(exports));