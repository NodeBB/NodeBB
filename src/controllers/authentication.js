'use strict';

const winston = require('winston');
const passport = require('passport');
const nconf = require('nconf');
const validator = require('validator');
const _ = require('lodash');
const util = require('util');

const db = require('../database');
const meta = require('../meta');
const analytics = require('../analytics');
const user = require('../user');
const plugins = require('../plugins');
const utils = require('../utils');
const slugify = require('../slugify');
const helpers = require('./helpers');
const privileges = require('../privileges');
const sockets = require('../socket.io');

const authenticationController = module.exports;

async function registerAndLoginUser(req, res, userData) {
	if (!userData.hasOwnProperty('email')) {
		userData.updateEmail = true;
	}

	const data = await user.interstitials.get(req, userData);

	// If interstitials are found, save registration attempt into session and abort
	const deferRegistration = data.interstitials.length;
	if (deferRegistration) {
		userData.register = true;
		req.session.registration = userData;

		if (req.body.noscript === 'true') {
			res.redirect(`${nconf.get('relative_path')}/register/complete`);
			return;
		}
		res.json({ next: `${nconf.get('relative_path')}/register/complete` });
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
		// Token has to be verified at this point
		await Promise.all([
			user.confirmIfInviteEmailIsUsed(userData.token, userData.email, uid),
			user.joinGroupsFromInvitation(uid, userData.token),
		]);
	}
	await user.deleteInvitationKey(userData.email, userData.token);
	const next = req.session.returnTo || `${nconf.get('relative_path')}/`;
	const complete = await plugins.hooks.fire('filter:register.complete', { uid: uid, next: next });
	req.session.returnTo = complete.next;
	return complete;
}

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

		if (
			!userData.username ||
			userData.username.length < meta.config.minimumUsernameLength ||
			slugify(userData.username).length < meta.config.minimumUsernameLength
		) {
			throw new Error('[[error:username-too-short]]');
		}

		if (userData.username.length > meta.config.maximumUsernameLength) {
			throw new Error('[[error:username-too-long]]');
		}

		if (userData.password !== userData['password-confirm']) {
			throw new Error('[[user:change-password-error-match]]');
		}

		if (userData.password.length > 512) {
			throw new Error('[[error:password-too-long]]');
		}

		user.isPasswordValid(userData.password);

		await plugins.hooks.fire('filter:password.check', { password: userData.password, uid: 0, userData: userData });

		res.locals.processLogin = true; // set it to false in plugin if you wish to just register only
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
			message += ` [[register:registration-queue-average-time, ${Math.floor(average_time / 60)}, ${Math.floor(average_time % 60)}]]`;
		}
	}
	if (meta.config.autoApproveTime > 0) {
		message += ` [[register:registration-queue-auto-approve-time, ${meta.config.autoApproveTime}]]`;
	}
	return { message: message };
}

authenticationController.registerComplete = async function (req, res) {
	try {
		// For the interstitials that respond, execute the callback with the form body
		const data = await user.interstitials.get(req, req.session.registration);
		const callbacks = data.interstitials.reduce((memo, cur) => {
			if (cur.hasOwnProperty('callback') && typeof cur.callback === 'function') {
				req.body.files = req.files;
				if (
					(cur.callback.constructor && cur.callback.constructor.name === 'AsyncFunction') ||
					cur.callback.length === 2 // non-async function w/o callback
				) {
					memo.push(cur.callback);
				} else {
					memo.push(util.promisify(cur.callback));
				}
			}

			return memo;
		}, []);

		const done = function (data) {
			delete req.session.registration;
			const relative_path = nconf.get('relative_path');
			if (data && data.message) {
				return res.redirect(`${relative_path}/?register=${encodeURIComponent(data.message)}`);
			}

			if (req.session.returnTo) {
				res.redirect(relative_path + req.session.returnTo.replace(new RegExp(`^${relative_path}`), ''));
			} else {
				res.redirect(`${relative_path}/`);
			}
		};

		const results = await Promise.allSettled(callbacks.map(async (cb) => {
			await cb(req.session.registration, req.body);
		}));
		const errors = results.map(result => result.status === 'rejected' && result.reason && result.reason.message).filter(Boolean);
		if (errors.length) {
			req.flash('errors', errors);
			return req.session.save(() => {
				res.redirect(`${nconf.get('relative_path')}/register/complete`);
			});
		}

		if (req.session.registration.register === true) {
			res.locals.processLogin = true;
			req.body.noscript = 'true'; // trigger full page load on error

			const data = await registerAndLoginUser(req, res, req.session.registration);
			if (!data) {
				return winston.warn('[register] Interstitial callbacks processed with no errors, but one or more interstitials remain. This is likely an issue with one of the interstitials not properly handling a null case or invalid value.');
			}
			done(data);
		} else {
			// Update user hash, clear registration data in session
			const payload = req.session.registration;
			const { uid } = payload;
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
	} catch (err) {
		delete req.session.registration;
		res.redirect(`${nconf.get('relative_path')}/?register=${encodeURIComponent(err.message)}`);
	}
};

authenticationController.registerAbort = async (req, res) => {
	if (req.uid && req.session.registration) {
		// Email is the only cancelable interstitial
		delete req.session.registration.updateEmail;

		const { interstitials } = await user.interstitials.get(req, req.session.registration);
		if (!interstitials.length) {
			delete req.session.registration;
			return res.redirect(nconf.get('relative_path') + (req.session.returnTo || '/'));
		}
	}

	// End the session and redirect to home
	req.session.destroy(() => {
		res.clearCookie(nconf.get('sessionKey'), meta.configs.cookie.get());
		res.redirect(`${nconf.get('relative_path')}/`);
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

	const loginWith = meta.config.allowLoginWith || 'username-email';
	req.body.username = String(req.body.username).trim();
	const errorHandler = res.locals.noScriptErrors || helpers.noScriptErrors;
	try {
		await plugins.hooks.fire('filter:login.check', { req: req, res: res, userData: req.body });
	} catch (err) {
		return errorHandler(req, res, err.message, 403);
	}
	try {
		const isEmailLogin = loginWith.includes('email') && req.body.username && utils.isEmailValid(req.body.username);
		const isUsernameLogin = loginWith.includes('username') && !validator.isEmail(req.body.username);
		if (isEmailLogin) {
			const username = await user.getUsernameByEmail(req.body.username);
			if (username !== '[[global:guest]]') {
				req.body.username = username;
			}
		}
		if (isEmailLogin || isUsernameLogin) {
			continueLogin(strategy, req, res, next);
		} else {
			errorHandler(req, res, `[[error:wrong-login-type-${loginWith}]]`, 400);
		}
	} catch (err) {
		return errorHandler(req, res, err.message, 500);
	}
};

function continueLogin(strategy, req, res, next) {
	passport.authenticate(strategy, async (err, userData, info) => {
		if (err) {
			plugins.hooks.fire('action:login.continue', { req, strategy, userData, error: err });
			return helpers.noScriptErrors(req, res, err.data || err.message, 403);
		}

		if (!userData) {
			if (info instanceof Error) {
				info = info.message;
			} else if (typeof info === 'object') {
				info = '[[error:invalid-username-or-password]]';
			}

			plugins.hooks.fire('action:login.continue', { req, strategy, userData, error: new Error(info) });
			return helpers.noScriptErrors(req, res, info, 403);
		}

		// Alter user cookie depending on passed-in option
		if (req.body.remember === 'on') {
			const duration = meta.getSessionTTLSeconds() * 1000;
			req.session.cookie.maxAge = duration;
			req.session.cookie.expires = new Date(Date.now() + duration);
		} else {
			const duration = meta.config.sessionDuration * 1000;
			req.session.cookie.maxAge = duration || false;
			req.session.cookie.expires = duration ? new Date(Date.now() + duration) : false;
		}

		plugins.hooks.fire('action:login.continue', { req, strategy, userData, error: null });

		if (userData.passwordExpiry && userData.passwordExpiry < Date.now()) {
			winston.verbose(`[auth] Triggering password reset for uid ${userData.uid} due to password policy`);
			req.session.passwordExpired = true;

			const code = await user.reset.generate(userData.uid);
			(res.locals.redirectAfterLogin || redirectAfterLogin)(req, res, `${nconf.get('relative_path')}/reset/${code}`);
		} else {
			delete req.query.lang;
			await authenticationController.doLogin(req, userData.uid);
			let destination;
			if (req.session.returnTo) {
				destination = req.session.returnTo.startsWith('http') ?
					req.session.returnTo :
					nconf.get('relative_path') + req.session.returnTo;
				delete req.session.returnTo;
			} else {
				destination = `${nconf.get('relative_path')}/`;
			}

			(res.locals.redirectAfterLogin || redirectAfterLogin)(req, res, destination);
		}
	})(req, res, next);
}

function redirectAfterLogin(req, res, destination) {
	if (req.body.noscript === 'true') {
		res.redirect(`${destination}?loggedin`);
	} else {
		res.status(200).send({
			next: destination,
		});
	}
}

authenticationController.doLogin = async function (req, uid) {
	if (!uid) {
		return;
	}
	const loginAsync = util.promisify(req.login).bind(req);
	await loginAsync({ uid: uid }, { keepSessionInfo: req.res.locals.reroll !== false });
	await authenticationController.onSuccessfulLogin(req, uid);
};

authenticationController.onSuccessfulLogin = async function (req, uid, trackSession = true) {
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
		await user.reset.cleanByUid(uid);

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
			new Promise((resolve) => {
				req.session.save(resolve);
			}),
			trackSession ? user.auth.addSession(uid, req.sessionID) : undefined,
			user.updateLastOnlineTime(uid),
			user.onUserOnline(uid, Date.now()),
			analytics.increment('logins'),
			db.incrObjectFieldBy('global', 'loginCount', 1),
		]);

		// Force session check for all connected socket.io clients with the same session id
		sockets.in(`sess_${req.sessionID}`).emit('checkSession', uid);

		plugins.hooks.fire('action:user.loggedIn', { uid: uid, req: req });
	} catch (err) {
		req.session.destroy();
		throw err;
	}
};

const destroyAsync = util.promisify((req, callback) => req.session.destroy(callback));
const logoutAsync = util.promisify((req, callback) => req.logout(callback));

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
			return next(await getBanError(uid));
		}

		// Doing this after the ban check, because user's privileges might change after a ban expires
		const hasLoginPrivilege = await privileges.global.can('local:login', uid);
		if (parseInt(uid, 10) && !hasLoginPrivilege) {
			return next(new Error('[[error:local-login-disabled]]'));
		}

		try {
			const passwordMatch = await user.isPasswordCorrect(uid, password, req.ip);
			if (!passwordMatch) {
				return next(new Error('[[error:invalid-login-credentials]]'));
			}
		} catch (e) {
			if (req.loggedIn) {
				await logoutAsync(req);
				await destroyAsync(req);
			}
			throw e;
		}

		next(null, userData, '[[success:authentication-successful]]');
	} catch (err) {
		next(err);
	}
};

authenticationController.logout = async function (req, res, next) {
	if (!req.loggedIn || !req.sessionID) {
		res.clearCookie(nconf.get('sessionKey'), meta.configs.cookie.get());
		return res.status(200).send('not-logged-in');
	}
	const { uid } = req;
	const { sessionID } = req;

	try {
		await user.auth.revokeSession(sessionID, uid);
		await logoutAsync(req);
		await destroyAsync(req);
		res.clearCookie(nconf.get('sessionKey'), meta.configs.cookie.get());

		await user.setUserField(uid, 'lastonline', Date.now() - (meta.config.onlineCutoff * 60000));
		await db.sortedSetAdd('users:online', Date.now() - (meta.config.onlineCutoff * 60000), uid);
		await plugins.hooks.fire('static:user.loggedOut', { req: req, res: res, uid: uid, sessionID: sessionID });

		// Force session check for all connected socket.io clients with the same session id
		sockets.in(`sess_${sessionID}`).emit('checkSession', 0);
		const payload = {
			next: `${nconf.get('relative_path')}/`,
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

async function getBanError(uid) {
	try {
		const banInfo = await user.getLatestBanInfo(uid);

		if (!banInfo.reason) {
			banInfo.reason = '[[user:info.banned-no-reason]]';
		}
		const err = new Error(banInfo.reason);
		err.data = banInfo;
		return err;
	} catch (err) {
		if (err.message === 'no-ban-info') {
			return new Error('[[error:user-banned]]');
		}
		throw err;
	}
}

require('../promisify')(authenticationController, ['register', 'registerComplete', 'registerAbort', 'login', 'localLogin', 'logout']);
