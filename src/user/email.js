
'use strict';

const nconf = require('nconf');
const winston = require('winston');

const user = require('./index');
const utils = require('../utils');
const plugins = require('../plugins');
const db = require('../database');
const meta = require('../meta');
const emailer = require('../emailer');
const groups = require('../groups');
const events = require('../events');

const UserEmail = module.exports;

UserEmail.exists = async function (email) {
	const uid = await user.getUidByEmail(email.toLowerCase());
	return !!uid;
};

UserEmail.available = async function (email) {
	const exists = await db.isSortedSetMember('email:uid', email.toLowerCase());
	return !exists;
};

UserEmail.remove = async function (uid, sessionId) {
	const email = await user.getUserField(uid, 'email');
	if (!email) {
		return;
	}

	await Promise.all([
		user.setUserFields(uid, {
			email: '',
			'email:confirmed': 0,
		}),
		db.sortedSetRemove('email:uid', email.toLowerCase()),
		db.sortedSetRemove('email:sorted', `${email.toLowerCase()}:${uid}`),
		user.email.expireValidation(uid),
		sessionId ? user.auth.revokeAllSessions(uid, sessionId) : Promise.resolve(),
		events.log({
			targetUid: uid,
			type: 'email-change',
			email,
			newEmail: '',
		}),
	]);
};

UserEmail.getEmailForValidation = async (uid) => {
	let email = '';
	// check email from confirmObj
	const code = await db.get(`confirm:byUid:${uid}`);
	const confirmObj = await db.getObject(`confirm:${code}`);
	if (confirmObj && confirmObj.email && parseInt(uid, 10) === parseInt(confirmObj.uid, 10)) {
		email = confirmObj.email;
	}

	if (!email) {
		email = await user.getUserField(uid, 'email');
	}
	return email;
};

UserEmail.isValidationPending = async (uid, email) => {
	const code = await db.get(`confirm:byUid:${uid}`);
	const confirmObj = await db.getObject(`confirm:${code}`);
	return !!(confirmObj && (
		(!email || email === confirmObj.email) && Date.now() < parseInt(confirmObj.expires, 10)
	));
};

UserEmail.getValidationExpiry = async (uid) => {
	const code = await db.get(`confirm:byUid:${uid}`);
	const confirmObj = await db.getObject(`confirm:${code}`);
	return confirmObj ? Math.max(0, confirmObj.expires - Date.now()) : null;
};

UserEmail.expireValidation = async (uid) => {
	const keys = [`confirm:byUid:${uid}`];
	const code = await db.get(`confirm:byUid:${uid}`);
	if (code) {
		keys.push(`confirm:${code}`);
	}
	await db.deleteAll(keys);
};

UserEmail.canSendValidation = async (uid, email) => {
	const pending = await UserEmail.isValidationPending(uid, email);
	if (!pending) {
		return true;
	}

	const ttl = await UserEmail.getValidationExpiry(uid);
	const max = meta.config.emailConfirmExpiry * 60 * 60 * 1000;
	const interval = meta.config.emailConfirmInterval * 60 * 1000;

	return (ttl || Date.now()) + interval < max;
};

UserEmail.sendValidationEmail = async function (uid, options) {
	/*
	 * Options:
	 * - email, overrides email retrieval
	 * - force, sends email even if it is too soon to send another
	 * - template, changes the template used for email sending
	 */

	if (meta.config.sendValidationEmail !== 1) {
		winston.verbose(`[user/email] Validation email for uid ${uid} not sent due to config settings`);
		return;
	}

	options = options || {};

	// Fallback behaviour (email passed in as second argument)
	if (typeof options === 'string') {
		options = {
			email: options,
		};
	}

	const confirm_code = utils.generateUUID();
	const confirm_link = `${nconf.get('url')}/confirm/${confirm_code}`;

	const { emailConfirmInterval, emailConfirmExpiry } = meta.config;

	// If no email passed in (default), retrieve email from uid
	if (!options.email || !options.email.length) {
		options.email = await user.getUserField(uid, 'email');
	}
	if (!options.email) {
		return;
	}

	if (!options.force && !await UserEmail.canSendValidation(uid, options.email)) {
		throw new Error(`[[error:confirm-email-already-sent, ${emailConfirmInterval}]]`);
	}

	const username = await user.getUserField(uid, 'username');
	const data = await plugins.hooks.fire('filter:user.verify', {
		uid,
		username,
		confirm_link,
		confirm_code: await plugins.hooks.fire('filter:user.verify.code', confirm_code),
		email: options.email,

		subject: options.subject || '[[email:email.verify-your-email.subject]]',
		template: options.template || 'verify-email',
	});

	await UserEmail.expireValidation(uid);
	await db.set(`confirm:byUid:${uid}`, confirm_code);

	await db.setObject(`confirm:${confirm_code}`, {
		email: options.email.toLowerCase(),
		uid: uid,
		expires: Date.now() + (emailConfirmExpiry * 60 * 60 * 1000),
	});

	winston.verbose(`[user/email] Validation email for uid ${uid} sent to ${options.email}`);
	events.log({
		type: 'email-confirmation-sent',
		uid,
		confirm_code,
		...options,
	});

	if (plugins.hooks.hasListeners('action:user.verify')) {
		plugins.hooks.fire('action:user.verify', { uid: uid, data: data });
	} else {
		await emailer.send(data.template, uid, data);
	}
	return confirm_code;
};

// confirm email by code sent by confirmation email
UserEmail.confirmByCode = async function (code, sessionId) {
	const confirmObj = await db.getObject(`confirm:${code}`);
	if (!confirmObj || !confirmObj.uid || !confirmObj.email) {
		throw new Error('[[error:invalid-data]]');
	}

	if (!confirmObj.expires || Date.now() > parseInt(confirmObj.expires, 10)) {
		throw new Error('[[error:confirm-email-expired]]');
	}

	// If another uid has the same email, remove it
	const oldUid = await db.sortedSetScore('email:uid', confirmObj.email.toLowerCase());
	if (oldUid) {
		await UserEmail.remove(oldUid, sessionId);
	}

	const oldEmail = await user.getUserField(confirmObj.uid, 'email');
	if (oldEmail && confirmObj.email !== oldEmail) {
		await UserEmail.remove(confirmObj.uid, sessionId);
	} else {
		await user.auth.revokeAllSessions(confirmObj.uid, sessionId);
	}

	await user.setUserField(confirmObj.uid, 'email', confirmObj.email);
	await Promise.all([
		UserEmail.confirmByUid(confirmObj.uid),
		db.delete(`confirm:${code}`),
		events.log({
			type: 'email-change',
			oldEmail,
			newEmail: confirmObj.email,
			targetUid: confirmObj.uid,
		}),
	]);
};

// confirm uid's email via ACP
UserEmail.confirmByUid = async function (uid, callerUid = 0) {
	if (!(parseInt(uid, 10) > 0)) {
		throw new Error('[[error:invalid-uid]]');
	}
	callerUid = callerUid || uid;
	const currentEmail = await user.getUserField(uid, 'email');
	if (!currentEmail) {
		throw new Error('[[error:invalid-email]]');
	}

	// If another uid has the same email throw error
	const oldUid = await db.sortedSetScore('email:uid', currentEmail.toLowerCase());
	if (oldUid && oldUid !== parseInt(uid, 10)) {
		throw new Error('[[error:email-taken]]');
	}

	const confirmedEmails = await db.getSortedSetRangeByScore(`email:uid`, 0, -1, uid, uid);
	if (confirmedEmails.length) {
		// remove old email of user by uid
		await db.sortedSetsRemoveRangeByScore([`email:uid`], uid, uid);
		await db.sortedSetRemoveBulk(
			confirmedEmails.map(email => [`email:sorted`, `${email.toLowerCase()}:${uid}`])
		);
	}
	await Promise.all([
		db.sortedSetAddBulk([
			['email:uid', uid, currentEmail.toLowerCase()],
			['email:sorted', 0, `${currentEmail.toLowerCase()}:${uid}`],
			[`user:${uid}:emails`, Date.now(), `${currentEmail}:${Date.now()}:${callerUid}`],
		]),
		user.setUserField(uid, 'email:confirmed', 1),
		groups.join('verified-users', uid),
		groups.leave('unverified-users', uid),
		user.email.expireValidation(uid),
		user.reset.cleanByUid(uid),
	]);
	await plugins.hooks.fire('action:user.email.confirmed', { uid: uid, email: currentEmail });
};
