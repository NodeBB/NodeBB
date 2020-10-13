'use strict';

var nconf = require('nconf');
var winston = require('winston');

var user = require('./index');
const groups = require('../groups');
var utils = require('../utils');
var batch = require('../batch');

var db = require('../database');
var meta = require('../meta');
var emailer = require('../emailer');

var UserReset = module.exports;

var twoHours = 7200000;

UserReset.validate = async function (code) {
	const uid = await db.getObjectField('reset:uid', code);
	if (!uid) {
		return false;
	}
	const issueDate = await db.sortedSetScore('reset:issueDate', code);
	return parseInt(issueDate, 10) > Date.now() - twoHours;
};

UserReset.generate = async function (uid) {
	const code = utils.generateUUID();
	await Promise.all([
		db.setObjectField('reset:uid', code, uid),
		db.sortedSetAdd('reset:issueDate', Date.now(), code),
	]);
	return code;
};

async function canGenerate(uid) {
	const score = await db.sortedSetScore('reset:issueDate:uid', uid);
	if (score > Date.now() - (1000 * 60)) {
		throw new Error('[[error:reset-rate-limited]]');
	}
}

UserReset.send = async function (email) {
	const uid = await user.getUidByEmail(email);
	if (!uid) {
		throw new Error('[[error:invalid-email]]');
	}
	await canGenerate(uid);
	await db.sortedSetAdd('reset:issueDate:uid', Date.now(), uid);
	const code = await UserReset.generate(uid);
	await emailer.send('reset', uid, {
		reset_link: nconf.get('url') + '/reset/' + code,
		subject: '[[email:password-reset-requested]]',
		template: 'reset',
		uid: uid,
	});
};

UserReset.commit = async function (code, password) {
	user.isPasswordValid(password);
	const validated = await UserReset.validate(code);
	if (!validated) {
		throw new Error('[[error:reset-code-not-valid]]');
	}
	const uid = await db.getObjectField('reset:uid', code);
	if (!uid) {
		throw new Error('[[error:reset-code-not-valid]]');
	}

	const hash = await user.hashPassword(password);

	await user.setUserFields(uid, { password: hash, 'email:confirmed': 1 });
	await groups.join('verified-users', uid);
	await groups.leave('unverified-users', uid);
	await db.deleteObjectField('reset:uid', code);
	await db.sortedSetRemoveBulk([
		['reset:issueDate', code],
		['reset:issueDate:uid', uid],
	]);
	await user.reset.updateExpiry(uid);
	await user.auth.resetLockout(uid);
	await db.delete('uid:' + uid + ':confirm:email:sent');
	await UserReset.cleanByUid(uid);
};

UserReset.updateExpiry = async function (uid) {
	const oneDay = 1000 * 60 * 60 * 24;
	const expireDays = meta.config.passwordExpiryDays;
	const expiry = Date.now() + (oneDay * expireDays);
	if (expireDays > 0) {
		await user.setUserField(uid, 'passwordExpiry', expiry);
	}
};

UserReset.clean = async function () {
	const [tokens, uids] = await Promise.all([
		db.getSortedSetRangeByScore('reset:issueDate', 0, -1, '-inf', Date.now() - twoHours),
		db.getSortedSetRangeByScore('reset:issueDate:uid', 0, -1, '-inf', Date.now() - twoHours),
	]);
	if (!tokens.length && !uids.length) {
		return;
	}

	winston.verbose('[UserReset.clean] Removing ' + tokens.length + ' reset tokens from database');
	await cleanTokensAndUids(tokens, uids);
};

UserReset.cleanByUid = async function (uid) {
	const tokensToClean = [];
	uid = parseInt(uid, 10);

	await batch.processSortedSet('reset:issueDate', async function (tokens) {
		const results = await db.getObjectFields('reset:uid', tokens);
		for (var code in results) {
			if (results.hasOwnProperty(code) && parseInt(results[code], 10) === uid) {
				tokensToClean.push(code);
			}
		}
	}, { batch: 500 });

	if (!tokensToClean.length) {
		winston.verbose('[UserReset.cleanByUid] No tokens found for uid (' + uid + ').');
		return;
	}

	winston.verbose('[UserReset.cleanByUid] Found ' + tokensToClean.length + ' token(s), removing...');
	await cleanTokensAndUids(tokensToClean, uid);
};

async function cleanTokensAndUids(tokens, uids) {
	await Promise.all([
		db.deleteObjectFields('reset:uid', tokens),
		db.sortedSetRemove('reset:issueDate', tokens),
		db.sortedSetRemove('reset:issueDate:uid', uids),
	]);
}
