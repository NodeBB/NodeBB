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
	const data = await plugins.hooks.fire('filter:register.interstitial', {
		userData: userData,
		interstitials: [],
	});

	// If interstitials are found, save registration attempt into session and abort
	const deferRegistration = data.interstitials.length;

	if (deferRegistration) {
		userData.register = true;
		req.session.registration = userData;

		if (req.body.referrer) {
			req.session.returnTo = req.body.referrer;
		}
		if (req.body.noscript === 'true') {
			res.redirect(nconf.get('relative_path') + '/register/complete');
			return;
		}
		res.json({ referrer: nconf.get('relative_path') + '/register/complete' });
		return;
	}
	const queue = await user.shouldQueueUser(req.ip);
	const result = await plugins.hooks.fire('filter:register.shouldQueue', { req: req, res: res, userData: userData, queue: queue });
	if (result.queue) {
		return await addToApprovalQueue(req, userData);
	}

	const uid = await user.create(userData);
	if (res.locals.processLogin) {
		await authenticationController.doLogin(req, uid);
	}

	// Distinguish registrations through invites from direct ones
	if (userData.token) {
		await user.joinGroupsFromInvitation(uid, userData.email);
	}
	await user.deleteInvitationKey(userData.email);
	const referrer = req.body.referrer || req.session.returnTo || nconf.get('relative_path') + '/';
	const complete = await plugins.hooks.fire('filter:register.complete', { uid: uid, referrer: referrer });
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
		if (userData.token || registrationType === 'invite-only' || registrationType === 'admin-invite-only') {
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
		await plugins.hooks.fire('filter:register.check', { req: req, res: res, userData: userData });

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
		if (average_time > 0) {
			message += ` [[register:registration-queue-average-time, ${Math.floor(average_time / 60)}, ${average_time % 60}]]`;
		}
	}
	if (meta.config.autoApproveTime > 0) {
		message += ` [[register:registration-queue-auto-approve-time, ${meta.config.autoApproveTime}]]`;
	}
	return { message: message };
}

authenticationController.registerComplete = function (req, res, next) {
	// For the interstitials that respond, execute the callback with the form body
	plugins.hooks.fire('filter:register.interstitial', {
		userData: req.session.registration,
		interstitials: [],
	}, async (err, data) => {
		if (err) {
			return next(err);
		}

		var callbacks = data.interstitials.reduce(function (memo, cur) {
			if (cur.hasOwnProperty('callback') && typeof cur.callback === 'function') {
				req.body.files = req.files;
				memo.push(cur.callback && cur.callback.constructor && cur.callback.constructor.name === 'AsyncFunction' ? cur.callback : util.promisify(cur.callback));
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

		const results = await Promise.allSettled(callbacks.map(async (cb) => {
			await cb(req.session.registration, req.body);
		}));
		const errors = results.map(result => result.reason && result.reason.message).filter(Boolean);
		if (errors.length) {
			req.flash('errors', errors);
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
};

authenticationController.registerAbort = function (req, res) {
	// End the session and redirect to home
	req.session.destroy(function () {
		res.clearCookie(nconf.get('sessionKey'), meta.configs.cookie.get());
		res.redirect(nconf.get('relative_path') + '/');
	});
};

authenticationController.login = async (req, res, next) => {
	let { strategy } = await plugins.hooks.fire('filter:login.override', { req, strategy: 'local' });
	if (!passport._strategy(strategy)) {
		winston.error(`[auth/override] Requested login strategy "${strategy}" not found, reverting back to local login strategy.`);
		strategy = 'local';
	}

	if (plugins.hooks.hasListeners('action:auth.overrideLogin')) {
		return continueLogin(strategy, req, res, next);
	}

	var loginWith = meta.config.allowLoginWith || 'username-email';
	req.body.username = req.body.username.trim();

	plugins.hooks.fire('filter:login.check', { req: req, res: res, userData: req.body }, (err) => {
		if (err) {
			return (res.locals.noScriptErrors || helpers.noScriptErrors)(req, res, err.message, 403);
		}
		if (req.body.username && utils.isEmailValid(req.body.username) && loginWith.includes('email')) {
			async.waterfall([
				function (next) {
					user.getUsernameByEmail(req.body.username, next);
				},
				function (username, next) {
					if (username !== '[[global:guest]]') {
						req.body.username = username;
					}

					(res.locals.continueLogin || continueLogin)(strategy, req, res, next);
				},
			], next);
		} else if (loginWith.includes('username') && !validator.isEmail(req.body.username)) {
			(res.locals.continueLogin || continueLogin)(strategy, req, res, next);
		} else {
			err = '[[error:wrong-login-type-' + loginWith + ']]';
			(res.locals.noScriptErrors || helpers.noScriptErrors)(req, res, err, 400);
		}
	});
};

function continueLogin(strategy, req, res, next) {
	passport.authenticate(strategy, async function (err, userData, info) {
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
		await user.bans.unbanIfExpired([uid]);

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

		plugins.hooks.fire('action:user.loggedIn', { uid: uid, req: req });
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
		const [userData, isAdminOrGlobalMod, canLoginIfBanned] = await Promise.all([
			user.getUserFields(uid, ['uid', 'passwordExpiry']),
			user.isAdminOrGlobalMod(uid),
			user.bans.canLoginIfBanned(uid),
		]);

		userData.isAdminOrGlobalMod = isAdminOrGlobalMod;

		if (!canLoginIfBanned) {
			const banMesage = await getBanInfo(uid);
			return next(new Error(banMesage));
		}

		// Doing this after the ban check, because user's privileges might change after a ban expires
		const hasLoginPrivilege = await privileges.global.can('local:login', uid);
		if (parseInt(uid, 10) && !hasLoginPrivilege) {
			return next(new Error('[[error:local-login-disabled]]'));
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
		await plugins.hooks.fire('static:user.loggedOut', { req: req, res: res, uid: uid, sessionID: sessionID });

		// Force session check for all connected socket.io clients with the same session id
		sockets.in('sess_' + sessionID).emit('checkSession', 0);
		const payload = {
			next: nconf.get('relative_path') + '/',
		};
		plugins.hooks.fire('filter:user.logout', payload);

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
