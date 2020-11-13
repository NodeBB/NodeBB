'use strict';

const async = require('async');
const winston = require('winston');
const passport = require('passport');
const nconf = require('nconf');
const validator = require('validator');
const _ = require('lodash');
const util = require('util');

const db = require('../database');
const meta = require('../meta');
const user = require('../user');
const plugins = require('../plugins');
const utils = require('../utils');
const slugify = require('../slugify');
const translator = require('../translator');
const helpers = require('./helpers');
const privileges = require('../privileges');
const sockets = require('../socket.io');

const authenticationController = module.exports;

async function registerAndLoginUser(req, res, userData) {
	const data = await plugins.fireHook('filter:register.interstitial', {
		userData: userData,
		interstitials: [],
	});

	// If interstitials are found, save registration attempt into session and abort
	const deferRegistration = data.interstitials.length;

	if (deferRegistration) {
		userData.register = true;
		req.session.registration = userData;

		if (req.body.referrer) {
			req.session.referrer = req.body.referrer;
		}
		if (req.body.noscript === 'true') {
			res.redirect(nconf.get('relative_path') + '/register/complete');
			return;
		}
		res.json({ referrer: nconf.get('relative_path') + '/register/complete' });
		return;
	}
	const queue = await user.shouldQueueUser(req.ip);
	const result = await plugins.fireHook('filter:register.shouldQueue', { req: req, res: res, userData: userData, queue: queue });
	if (result.queue) {
		return await addToApprovalQueue(req, userData);
	}

	const uid = await user.create(userData);
	if (res.locals.processLogin) {
		await authenticationController.doLogin(req, uid);
	}

	user.deleteInvitationKey(userData.email);
	const referrer = req.body.referrer || req.session.referrer || nconf.get('relative_path') + '/';
	const complete = await plugins.fireHook('filter:register.complete', { uid: uid, referrer: referrer });
	req.session.returnTo = complete.referrer;
	return complete;
}

const registerAndLoginUserCallback = util.callbackify(registerAndLoginUser);


authenticationController.register = async function (req, res) {
	const registrationType = meta.config.registrationType || 'normal';

	if (registrationType === 'disabled') {
		return res.sendStatus(403);
	}

	const userData = req.body;
	try {
		if (registrationType === 'invite-only' || registrationType === 'admin-invite-only') {
			await user.verifyInvitation(userData);
		}

		if (!userData.email) {
			throw new Error('[[error:invalid-email]]');
		}

		if (!userData.username || userData.username.length < meta.config.minimumUsernameLength || slugify(userData.username).length < meta.config.minimumUsernameLength) {
			throw new Error('[[error:username-too-short]]');
		}

		if (userData.username.length > meta.config.maximumUsernameLength) {
			throw new Error('[[error:username-too-long]]');
		}

		if (userData.password !== userData['password-confirm']) {
			throw new Error('[[user:change_password_error_match]]');
		}

		if (userData.password.length > 512) {
			throw new Error('[[error:password-too-long]]');
		}

		user.isPasswordValid(userData.password);

		res.locals.processLogin = true;	// set it to false in plugin if you wish to just register only
		await plugins.fireHook('filter:register.check', { req: req, res: res, userData: userData });

		const data = await registerAndLoginUser(req, res, userData);
		if (data) {
			if (data.uid && req.body.userLang) {
				await user.setSetting(data.uid, 'userLang', req.body.userLang);
			}
			res.json(data);
		}
	} catch (err) {
		helpers.noScriptErrors(req, res, err.message, 400);
	}
};

async function addToApprovalQueue(req, userData) {
	userData.ip = req.ip;
	await user.addToApprovalQueue(userData);
	let message = '[[register:registration-added-to-queue]]';
	if (meta.config.showAverageApprovalTime) {
		const average_time = await db.getObjectField('registration:queue:approval:times', 'average');
		message += ` [[register:registration-queue-average-time, ${Math.floor(average_time / 60)}, ${average_time % 60}]]`;
	}
	if (meta.config.autoApproveTime > 0) {
		message += ` [[register:registration-queue-auto-approve-time, ${meta.config.autoApproveTime}]]`;
	}
	return { message: message };
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
				req.body.files = req.files;
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
			if (err) {
				return res.redirect(nconf.get('relative_path') + '/?register=' + encodeURIComponent(err.message));
			}

			if (!err && data && data.message) {
				return res.redirect(nconf.get('relative_path') + '/?register=' + encodeURIComponent(data.message));
			}
			if (req.session.returnTo) {
				res.redirect(nconf.get('relative_path') + req.session.returnTo);
			} else {
				res.redirect(nconf.get('relative_path') + '/');
			}
		};

		async.parallel(callbacks, async function (_blank, err) {
			if (err.length) {
				err = err.filter(Boolean).map(err => err.message);
			}

			if (err.length) {
				req.flash('errors', err);
				return res.redirect(nconf.get('relative_path') + '/register/complete');
			}

			if (req.session.registration.register === true) {
				res.locals.processLogin = true;
				registerAndLoginUserCallback(req, res, req.session.registration, done);
			} else {
				// Update user hash, clear registration data in session
				const payload = req.session.registration;
				const uid = payload.uid;
				delete payload.uid;
				delete payload.returnTo;

				Object.keys(payload).forEach((prop) => {
					if (typeof payload[prop] === 'boolean') {
						payload[prop] = payload[prop] ? 1 : 0;
					}
				});

				await user.setUserFields(uid, payload);
				done();
			}
		});
	});
};

authenticationController.registerAbort = function (req, res) {
	// End the session and redirect to home
	req.session.destroy(function () {
		res.clearCookie(nconf.get('sessionKey'), meta.configs.cookie.get());
		res.redirect(nconf.get('relative_path') + '/');
	});
};

authenticationController.login = function (req, res, next) {
	if (plugins.hasListeners('action:auth.overrideLogin')) {
		return continueLogin(req, res, next);
	}

	var loginWith = meta.config.allowLoginWith || 'username-email';
	req.body.username = req.body.username.trim();

	plugins.fireHook('filter:login.check', { req: req, res: res, userData: req.body }, (err) => {
		if (err) {
			return helpers.noScriptErrors(req, res, err.message, 403);
		}
		if (req.body.username && utils.isEmailValid(req.body.username) && loginWith.includes('email')) {
			async.waterfall([
				function (next) {
					user.getUsernameByEmail(req.body.username, next);
				},
				function (username, next) {
					req.body.username = username || req.body.username;
					continueLogin(req, res, next);
				},
			], next);
		} else if (loginWith.includes('username') && !validator.isEmail(req.body.username)) {
			continueLogin(req, res, next);
		} else {
			err = '[[error:wrong-login-type-' + loginWith + ']]';
			helpers.noScriptErrors(req, res, err, 500);
		}
	});
};

function continueLogin(req, res, next) {
	passport.authenticate('local', async function (err, userData, info) {
		if (err) {
			return helpers.noScriptErrors(req, res, err.message, 403);
		}

		if (!userData) {
			if (typeof info === 'object') {
				info = '[[error:invalid-username-or-password]]';
			}
			return helpers.noScriptErrors(req, res, info, 403);
		}

		// Alter user cookie depending on passed-in option
		if (req.body.remember === 'on') {
			var duration = 1000 * 60 * 60 * 24 * meta.config.loginDays;
			req.session.cookie.maxAge = duration;
			req.session.cookie.expires = new Date(Date.now() + duration);
		} else {
			req.session.cookie.maxAge = false;
			req.session.cookie.expires = false;
		}

		if (userData.passwordExpiry && userData.passwordExpiry < Date.now()) {
			winston.verbose('[auth] Triggering password reset for uid ' + userData.uid + ' due to password policy');
			req.session.passwordExpired = true;

			const code = await user.reset.generate(userData.uid);
			res.status(200).send({
				next: nconf.get('relative_path') + '/reset/' + code,
			});
		} else {
			delete req.query.lang;
			await authenticationController.doLogin(req, userData.uid);
			var destination;
			if (req.session.returnTo) {
				destination = req.session.returnTo.startsWith('http') ?
					req.session.returnTo :
					nconf.get('relative_path') + req.session.returnTo;
				delete req.session.returnTo;
			} else {
				destination = nconf.get('relative_path') + '/';
			}

			if (req.body.noscript === 'true') {
				res.redirect(destination + '?loggedin');
			} else {
				res.status(200).send({
					next: destination,
				});
			}
		}
	})(req, res, next);
}

authenticationController.doLogin = async function (req, uid) {
	if (!uid) {
		return;
	}
	const loginAsync = util.promisify(req.login).bind(req);
	await loginAsync({ uid: uid });
	await authenticationController.onSuccessfulLogin(req, uid);
};

authenticationController.onSuccessfulLogin = async function (req, uid) {
	/*
	 * Older code required that this method be called from within the SSO plugin.
	 * That behaviour is no longer required, onSuccessfulLogin is now automatically
	 * called in NodeBB core. However, if already called, return prematurely
	 */
	if (req.loggedIn && !req.session.forceLogin) {
		return true;
	}

	try {
		const uuid = utils.generateUUID();

		req.uid = uid;
		req.loggedIn = true;
		await meta.blacklist.test(req.ip);
		await user.logIP(uid, req.ip);

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
		await Promise.all([
			user.auth.addSession(uid, req.sessionID),
			user.updateLastOnlineTime(uid),
			user.updateOnlineUsers(uid),
		]);
		if (uid > 0) {
			await db.setObjectField('uid:' + uid + ':sessionUUID:sessionId', uuid, req.sessionID);
		}

		// Force session check for all connected socket.io clients with the same session id
		sockets.in('sess_' + req.sessionID).emit('checkSession', uid);

		plugins.fireHook('action:user.loggedIn', { uid: uid, req: req });
	} catch (err) {
		req.session.destroy();
		throw err;
	}
};

authenticationController.localLogin = async function (req, username, password, next) {
	if (!username) {
		return next(new Error('[[error:invalid-username]]'));
	}

	if (!password || !utils.isPasswordValid(password)) {
		return next(new Error('[[error:invalid-password]]'));
	}

	if (password.length > 512) {
		return next(new Error('[[error:password-too-long]]'));
	}

	const userslug = slugify(username);
	const uid = await user.getUidByUserslug(userslug);
	try {
		const [userData, isAdminOrGlobalMod, banned, hasLoginPrivilege] = await Promise.all([
			user.getUserFields(uid, ['uid', 'passwordExpiry']),
			user.isAdminOrGlobalMod(uid),
			user.bans.isBanned(uid),
			privileges.global.can('local:login', uid),
		]);

		userData.isAdminOrGlobalMod = isAdminOrGlobalMod;

		if (parseInt(uid, 10) && !hasLoginPrivilege) {
			return next(new Error('[[error:local-login-disabled]]'));
		}

		if (banned) {
			const banMesage = await getBanInfo(uid);
			return next(new Error(banMesage));
		}

		const passwordMatch = await user.isPasswordCorrect(uid, password, req.ip);
		if (!passwordMatch) {
			return next(new Error('[[error:invalid-login-credentials]]'));
		}

		next(null, userData, '[[success:authentication-successful]]');
	} catch (err) {
		next(err);
	}
};

const destroyAsync = util.promisify((req, callback) => req.session.destroy(callback));

authenticationController.logout = async function (req, res, next) {
	if (!req.loggedIn || !req.sessionID) {
		res.clearCookie(nconf.get('sessionKey'), meta.configs.cookie.get());
		return res.status(200).send('not-logged-in');
	}
	const uid = req.uid;
	const sessionID = req.sessionID;

	try {
		await user.auth.revokeSession(sessionID, uid);
		req.logout();

		await destroyAsync(req);
		res.clearCookie(nconf.get('sessionKey'), meta.configs.cookie.get());
		req.uid = 0;
		req.headers['x-csrf-token'] = req.csrfToken();

		await user.setUserField(uid, 'lastonline', Date.now() - (meta.config.onlineCutoff * 60000));
		await db.sortedSetAdd('users:online', Date.now() - (meta.config.onlineCutoff * 60000), uid);
		await plugins.fireHook('static:user.loggedOut', { req: req, res: res, uid: uid, sessionID: sessionID });

		// Force session check for all connected socket.io clients with the same session id
		sockets.in('sess_' + sessionID).emit('checkSession', 0);
		const payload = {
			next: nconf.get('relative_path') + '/',
		};
		plugins.fireHook('filter:user.logout', payload);

		if (req.body.noscript === 'true') {
			return res.redirect(payload.next);
		}
		res.status(200).send(payload);
	} catch (err) {
		next(err);
	}
};

async function getBanInfo(uid) {
	try {
		const banInfo = await user.getLatestBanInfo(uid);

		if (!banInfo.reason) {
			banInfo.reason = await translator.translate('[[user:info.banned-no-reason]]');
		}
		return banInfo.banned_until ?
			'[[error:user-banned-reason-until, ' + banInfo.banned_until_readable + ', ' + banInfo.reason + ']]' :
			'[[error:user-banned-reason, ' + banInfo.reason + ']]';
	} catch (err) {
		if (err.message === 'no-ban-info') {
			return '[[error:user-banned]]';
		}
		throw err;
	}
}

require('../promisify')(authenticationController, ['register', 'registerComplete', 'registerAbort', 'login', 'localLogin', 'logout']);
