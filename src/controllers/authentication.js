'use strict';

var async = require('async');
var winston = require('winston');
var passport = require('passport');
var nconf = require('nconf');
var validator = require('validator');
var _ = require('lodash');

var db = require('../database');
var meta = require('../meta');
var user = require('../user');
var plugins = require('../plugins');
var utils = require('../utils');
var translator = require('../translator');
var helpers = require('./helpers');
var privileges = require('../privileges');
var sockets = require('../socket.io');

var authenticationController = module.exports;

authenticationController.register = function (req, res) {
	var registrationType = meta.config.registrationType || 'normal';

	if (registrationType === 'disabled') {
		return res.sendStatus(403);
	}

	var userData = req.body;

	async.waterfall([
		function (next) {
			if (registrationType === 'invite-only' || registrationType === 'admin-invite-only') {
				user.verifyInvitation(userData, next);
			} else {
				next();
			}
		},
		function (next) {
			if (!userData.email) {
				return next(new Error('[[error:invalid-email]]'));
			}

			if (!userData.username || userData.username.length < meta.config.minimumUsernameLength || utils.slugify(userData.username).length < meta.config.minimumUsernameLength) {
				return next(new Error('[[error:username-too-short]]'));
			}

			if (userData.username.length > meta.config.maximumUsernameLength) {
				return next(new Error('[[error:username-too-long]]'));
			}

			if (userData.password !== userData['password-confirm']) {
				return next(new Error('[[user:change_password_error_match]]'));
			}

			user.isPasswordValid(userData.password, next);
		},
		function (next) {
			res.locals.processLogin = true;	// set it to false in plugin if you wish to just register only
			plugins.fireHook('filter:register.check', { req: req, res: res, userData: userData }, next);
		},
		function (result, next) {
			registerAndLoginUser(req, res, userData, next);
		},
	], function (err, data) {
		if (err) {
			return helpers.noScriptErrors(req, res, err.message, 400);
		}

		if (data.uid && req.body.userLang) {
			user.setSetting(data.uid, 'userLang', req.body.userLang);
		}

		res.json(data);
	});
};

function registerAndLoginUser(req, res, userData, callback) {
	var uid;
	async.waterfall([
		function (next) {
			plugins.fireHook('filter:register.interstitial', {
				userData: userData,
				interstitials: [],
			}, next);
		},
		function (data, next) {
			// If interstitials are found, save registration attempt into session and abort
			var deferRegistration = data.interstitials.length;

			if (!deferRegistration) {
				return next();
			}
			userData.register = true;
			req.session.registration = userData;

			if (req.body.noscript === 'true') {
				return res.redirect(nconf.get('relative_path') + '/register/complete');
			}
			return res.json({ referrer: nconf.get('relative_path') + '/register/complete' });
		},
		function (next) {
			user.shouldQueueUser(req.ip, next);
		},
		function (queue, next) {
			plugins.fireHook('filter:register.shouldQueue', { req: req, res: res, userData: userData, queue: queue }, next);
		},
		function (data, next) {
			if (data.queue) {
				addToApprovalQueue(req, userData, callback);
			} else {
				user.create(userData, next);
			}
		},
		function (_uid, next) {
			uid = _uid;
			if (res.locals.processLogin) {
				authenticationController.doLogin(req, uid, next);
			} else {
				next();
			}
		},
		function (next) {
			user.deleteInvitationKey(userData.email);
			plugins.fireHook('filter:register.complete', { uid: uid, referrer: req.body.referrer || nconf.get('relative_path') + '/' }, next);
		},
	], callback);
}

function addToApprovalQueue(req, userData, callback) {
	async.waterfall([
		function (next) {
			userData.ip = req.ip;
			user.addToApprovalQueue(userData, next);
		},
		function (next) {
			next(null, { message: '[[register:registration-added-to-queue]]' });
		},
	], callback);
}

authenticationController.registerComplete = function (req, res, next) {
	// For the interstitials that respond, execute the callback with the form body
	plugins.fireHook('filter:register.interstitial', {
		userData: req.session.registration,
		interstitials: [],
	}, function (err, data) {
		if (err) {
			return next(err);
		}

		var callbacks = data.interstitials.reduce(function (memo, cur) {
			if (cur.hasOwnProperty('callback') && typeof cur.callback === 'function') {
				memo.push(function (next) {
					cur.callback(req.session.registration, req.body, function (err) {
						// Pass error as second argument so all callbacks are executed
						next(null, err);
					});
				});
			}

			return memo;
		}, []);

		var done = function (err, data) {
			delete req.session.registration;
			if (!err && data && data.message) {
				return res.redirect(nconf.get('relative_path') + '/?register=' + encodeURIComponent(data.message));
			}
			if (req.session.returnTo) {
				res.redirect(req.session.returnTo);
			} else {
				res.redirect(nconf.get('relative_path') + '/');
			}
		};

		async.parallel(callbacks, function (_blank, err) {
			if (err.length) {
				err = err.filter(Boolean).map(function (err) {
					return err.message;
				});
			}

			if (err.length) {
				req.flash('errors', err);
				return res.redirect(nconf.get('relative_path') + '/register/complete');
			}

			if (req.session.registration.register === true) {
				res.locals.processLogin = true;
				registerAndLoginUser(req, res, req.session.registration, done);
			} else {
				// Update user hash, clear registration data in session
				const payload = req.session.registration;
				const uid = payload.uid;
				delete payload.uid;

				Object.keys(payload).forEach((prop) => {
					if (typeof payload[prop] === 'boolean') {
						payload[prop] = payload[prop] ? 1 : 0;
					}
				});

				user.setUserFields(uid, payload, done);
			}
		});
	});
};

authenticationController.registerAbort = function (req, res) {
	// End the session and redirect to home
	req.session.destroy(function () {
		res.redirect(nconf.get('relative_path') + '/');
	});
};

authenticationController.login = function (req, res, next) {
	if (plugins.hasListeners('action:auth.overrideLogin')) {
		return continueLogin(req, res, next);
	}

	var loginWith = meta.config.allowLoginWith || 'username-email';

	if (req.body.username && utils.isEmailValid(req.body.username) && loginWith.indexOf('email') !== -1) {
		async.waterfall([
			function (next) {
				user.getUsernameByEmail(req.body.username, next);
			},
			function (username, next) {
				req.body.username = username || req.body.username;
				continueLogin(req, res, next);
			},
		], next);
	} else if (loginWith.indexOf('username') !== -1 && !validator.isEmail(req.body.username)) {
		continueLogin(req, res, next);
	} else {
		var err = '[[error:wrong-login-type-' + loginWith + ']]';
		helpers.noScriptErrors(req, res, err, 500);
	}
};

function continueLogin(req, res, next) {
	passport.authenticate('local', function (err, userData, info) {
		if (err) {
			return helpers.noScriptErrors(req, res, err.message, 403);
		}

		if (!userData) {
			if (typeof info === 'object') {
				info = '[[error:invalid-username-or-password]]';
			}
			return helpers.noScriptErrors(req, res, info, 403);
		}

		var passwordExpiry = userData.passwordExpiry !== undefined ? parseInt(userData.passwordExpiry, 10) : null;

		// Alter user cookie depending on passed-in option
		if (req.body.remember === 'on') {
			var duration = 1000 * 60 * 60 * 24 * (parseInt(meta.config.loginDays, 10) || 14);
			req.session.cookie.maxAge = duration;
			req.session.cookie.expires = new Date(Date.now() + duration);
		} else {
			req.session.cookie.maxAge = false;
			req.session.cookie.expires = false;
		}

		if (passwordExpiry && passwordExpiry < Date.now()) {
			winston.verbose('[auth] Triggering password reset for uid ' + userData.uid + ' due to password policy');
			req.session.passwordExpired = true;
			user.reset.generate(userData.uid, function (err, code) {
				if (err) {
					return helpers.noScriptErrors(req, res, err.message, 403);
				}

				res.status(200).send(nconf.get('relative_path') + '/reset/' + code);
			});
		} else {
			authenticationController.doLogin(req, userData.uid, function (err) {
				if (err) {
					return helpers.noScriptErrors(req, res, err.message, 403);
				}

				var destination;
				if (!req.session.returnTo) {
					destination = nconf.get('relative_path') + '/';
				} else {
					destination = req.session.returnTo;
					delete req.session.returnTo;
				}

				if (req.body.noscript === 'true') {
					res.redirect(destination + '?loggedin');
				} else {
					res.status(200).send(destination);
				}
			});
		}
	})(req, res, next);
}

authenticationController.doLogin = function (req, uid, callback) {
	if (!uid) {
		return callback();
	}
	async.waterfall([
		function (next) {
			req.login({ uid: uid }, next);
		},
		function (next) {
			authenticationController.onSuccessfulLogin(req, uid, next);
		},
	], callback);
};

authenticationController.onSuccessfulLogin = function (req, uid, callback) {
	var uuid = utils.generateUUID();

	async.waterfall([
		function (next) {
			meta.blacklist.test(req.ip, next);
		},
		function (next) {
			user.logIP(uid, req.ip, next);
		},
		function (next) {
			req.session.meta = {};

			delete req.session.forceLogin;
			// Associate IP used during login with user account
			req.session.meta.ip = req.ip;

			// Associate metadata retrieved via user-agent
			req.session.meta = _.extend(req.session.meta, {
				uuid: uuid,
				datetime: Date.now(),
				platform: req.useragent.platform,
				browser: req.useragent.browser,
				version: req.useragent.version,
			});

			async.parallel([
				function (next) {
					user.auth.addSession(uid, req.sessionID, next);
				},
				function (next) {
					db.setObjectField('uid:' + uid + ':sessionUUID:sessionId', uuid, req.sessionID, next);
				},
				function (next) {
					user.updateLastOnlineTime(uid, next);
				},
			], function (err) {
				next(err);
			});
		},
		function (next) {
			// Force session check for all connected socket.io clients with the same session id
			sockets.in('sess_' + req.sessionID).emit('checkSession', uid);

			plugins.fireHook('action:user.loggedIn', { uid: uid, req: req });
			next();
		},
	], function (err) {
		if (err) {
			req.session.destroy();
		}

		if (typeof callback === 'function') {
			callback(err);
		} else {
			return false;
		}
	});
};

authenticationController.localLogin = function (req, username, password, next) {
	if (!username) {
		return next(new Error('[[error:invalid-username]]'));
	}

	var userslug = utils.slugify(username);
	var uid;
	var userData = {};

	if (!password || !utils.isPasswordValid(password)) {
		return next(new Error('[[error:invalid-password]]'));
	}

	if (password.length > 4096) {
		return next(new Error('[[error:password-too-long]]'));
	}

	async.waterfall([
		function (next) {
			user.getUidByUserslug(userslug, next);
		},
		function (_uid, next) {
			uid = _uid;

			async.parallel({
				userData: async.apply(db.getObjectFields, 'user:' + uid, ['passwordExpiry']),
				isAdminOrGlobalMod: function (next) {
					user.isAdminOrGlobalMod(uid, next);
				},
				banned: function (next) {
					user.isBanned(uid, next);
				},
				hasLoginPrivilege: function (next) {
					privileges.global.can('local:login', uid, next);
				},
			}, next);
		},
		function (result, next) {
			userData = Object.assign(result.userData, {
				uid: uid,
				isAdminOrGlobalMod: result.isAdminOrGlobalMod,
			});

			if (parseInt(uid, 10) && !result.hasLoginPrivilege) {
				return next(new Error('[[error:local-login-disabled]]'));
			}

			if (result.banned) {
				return getBanInfo(uid, next);
			}

			user.isPasswordCorrect(uid, password, req.ip, next);
		},
		function (passwordMatch, next) {
			if (!passwordMatch) {
				return next(new Error('[[error:invalid-login-credentials]]'));
			}

			next(null, userData, '[[success:authentication-successful]]');
		},
	], next);
};

authenticationController.logout = function (req, res, next) {
	if (!req.loggedIn || !req.sessionID) {
		return res.status(200).send('not-logged-in');
	}

	async.waterfall([
		function (next) {
			user.auth.revokeSession(req.sessionID, req.uid, next);
		},
		function (next) {
			req.logout();
			req.session.destroy(function (err) {
				next(err);
			});
		},
		function (next) {
			user.setUserField(req.uid, 'lastonline', Date.now() - 300000, next);
		},
		function (next) {
			plugins.fireHook('static:user.loggedOut', { req: req, res: res, uid: req.uid }, next);
		},
		function () {
			// Force session check for all connected socket.io clients with the same session id
			sockets.in('sess_' + req.sessionID).emit('checkSession', 0);
			if (req.body.noscript === 'true') {
				res.redirect(nconf.get('relative_path') + '/');
			} else {
				res.status(200).send('');
			}
		},
	], next);
};

function getBanInfo(uid, callback) {
	var banInfo;
	async.waterfall([
		function (next) {
			user.getLatestBanInfo(uid, next);
		},
		function (_banInfo, next) {
			banInfo = _banInfo;
			if (banInfo.reason) {
				return next();
			}

			translator.translate('[[user:info.banned-no-reason]]', function (translated) {
				banInfo.reason = translated;
				next();
			});
		},
		function (next) {
			next(new Error(banInfo.expiry ? '[[error:user-banned-reason-until, ' + banInfo.expiry_readable + ', ' + banInfo.reason + ']]' : '[[error:user-banned-reason, ' + banInfo.reason + ']]'));
		},
	], function (err) {
		if (err) {
			if (err.message === 'no-ban-info') {
				err.message = '[[error:user-banned]]';
			}
		}
		callback(err);
	});
}
