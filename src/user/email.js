
'use strict';

var nconf = require('nconf');

var user = require('./index');
var utils = require('../utils');
var plugins = require('../plugins');
var db = require('../database');
var meta = require('../meta');
var emailer = require('../emailer');
const groups = require('../groups');

var UserEmail = module.exports;

UserEmail.exists = async function (email) {
	const uid = await user.getUidByEmail(email.toLowerCase());
	return !!uid;
};

UserEmail.available = async function (email) {
	const exists = await db.isSortedSetMember('email:uid', email.toLowerCase());
	return !exists;
};

UserEmail.sendValidationEmail = async function (uid, options) {
	/*
	 * 	Options:
	 * 		- email, overrides email retrieval
	 * 		- force, sends email even if it is too soon to send another
	 */

	options = options || {};

	// Fallback behaviour (email passed in as second argument)
	if (typeof options === 'string') {
		options = {
			email: options,
		};
	}

	let confirm_code = utils.generateUUID();
	const confirm_link = nconf.get('url') + '/confirm/' + confirm_code;

	const emailInterval = meta.config.emailConfirmInterval;

	// If no email passed in (default), retrieve email from uid
	if (!options.email || !options.email.length) {
		options.email = await user.getUserField(uid, 'email');
	}
	if (!options.email) {
		return;
	}
	let sent = false;
	if (!options.force) {
		sent = await db.get('uid:' + uid + ':confirm:email:sent');
	}
	if (sent) {
		throw new Error('[[error:confirm-email-already-sent, ' + emailInterval + ']]');
	}
	await db.set('uid:' + uid + ':confirm:email:sent', 1);
	await db.pexpireAt('uid:' + uid + ':confirm:email:sent', Date.now() + (emailInterval * 60 * 1000));
	confirm_code = await plugins.hooks.fire('filter:user.verify.code', confirm_code);

	await db.setObject('confirm:' + confirm_code, {
		email: options.email.toLowerCase(),
		uid: uid,
	});
	await db.expireAt('confirm:' + confirm_code, Math.floor((Date.now() / 1000) + (60 * 60 * 24)));
	const username = await user.getUserField(uid, 'username');

	const data = {
		username: username,
		confirm_link: confirm_link,
		confirm_code: confirm_code,

		subject: options.subject || '[[email:welcome-to, ' + (meta.config.title || meta.config.browserTitle || 'NodeBB') + ']]',
		template: options.template || 'welcome',
		uid: uid,
	};

	if (plugins.hooks.hasListeners('action:user.verify')) {
		plugins.hooks.fire('action:user.verify', { uid: uid, data: data });
	} else {
		await emailer.send(data.template, uid, data);
	}
	return confirm_code;
};

UserEmail.confirm = async function (code) {
	const confirmObj = await db.getObject('confirm:' + code);
	if (!confirmObj || !confirmObj.uid || !confirmObj.email) {
		throw new Error('[[error:invalid-data]]');
	}
	const currentEmail = await user.getUserField(confirmObj.uid, 'email');
	if (!currentEmail || currentEmail.toLowerCase() !== confirmObj.email) {
		throw new Error('[[error:invalid-email]]');
	}
	await user.setUserField(confirmObj.uid, 'email:confirmed', 1);
	await groups.join('verified-users', confirmObj.uid);
	await groups.leave('unverified-users', confirmObj.uid);
	await db.delete('confirm:' + code);
	await db.delete('uid:' + confirmObj.uid + ':confirm:email:sent');
	await plugins.hooks.fire('action:user.email.confirmed', { uid: confirmObj.uid, email: confirmObj.email });
};
