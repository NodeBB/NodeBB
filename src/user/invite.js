
'use strict';

var async = require('async');
var nconf = require('nconf');
var validator = require('validator');

var db = require('../database');
var meta = require('../meta');
var emailer = require('../emailer');
var translator = require('../translator');
var utils = require('../utils');

module.exports = function (User) {
	User.getInvites = async function (uid) {
		const emails = await db.getSetMembers('invitation:uid:' + uid);
		return emails.map(email => validator.escape(String(email)));
	};

	User.getInvitesNumber = async function (uid) {
		return await db.setCount('invitation:uid:' + uid);
	};

	User.getInvitingUsers = async function () {
		return await db.getSetMembers('invitation:uids');
	};

	User.getAllInvites = async function () {
		const uids = await User.getInvitingUsers();
		const invitations = await async.map(uids, User.getInvites);
		return invitations.map(function (invites, index) {
			return {
				uid: uids[index],
				invitations: invites,
			};
		});
	};

	User.sendInvitationEmail = async function (uid, email) {
		const token = utils.generateUUID();
		const registerLink = nconf.get('url') + '/register?token=' + token + '&email=' + encodeURIComponent(email);

		const expireDays = meta.config.inviteExpiration;
		const expireIn = expireDays * 86400000;

		const exists = await User.getUidByEmail(email);
		if (exists) {
			throw new Error('[[error:email-taken]]');
		}
		await db.setAdd('invitation:uid:' + uid, email);
		await db.setAdd('invitation:uids', uid);
		await db.set('invitation:email:' + email, token);
		await db.pexpireAt('invitation:email:' + email, Date.now() + expireIn);
		const username = await User.getUserField(uid, 'username');
		const title = meta.config.title || meta.config.browserTitle || 'NodeBB';
		const subject = await translator.translate('[[email:invite, ' + title + ']]', meta.config.defaultLang);
		let data = {
			site_title: title,
			registerLink: registerLink,
			subject: subject,
			username: username,
			template: 'invitation',
			expireDays: expireDays,
		};

		// Append default data to this email payload
		data = { ...emailer._defaultPayload, ...data };

		await emailer.sendToEmail('invitation', email, meta.config.defaultLang, data);
	};

	User.verifyInvitation = async function (query) {
		if (!query.token || !query.email) {
			throw new Error('[[error:invalid-data]]');
		}
		const token = await db.get('invitation:email:' + query.email);
		if (!token || token !== query.token) {
			throw new Error('[[error:invalid-token]]');
		}
	};

	User.deleteInvitation = async function (invitedBy, email) {
		const invitedByUid = await User.getUidByUsername(invitedBy);
		if (!invitedByUid) {
			throw new Error('[[error:invalid-username]]');
		}
		await Promise.all([
			deleteFromReferenceList(invitedByUid, email),
			db.delete('invitation:email:' + email),
		]);
	};

	User.deleteInvitationKey = async function (email) {
		const uids = await User.getInvitingUsers();
		await Promise.all(uids.map(uid => deleteFromReferenceList(uid, email)));
		await db.delete('invitation:email:' + email);
	};

	async function deleteFromReferenceList(uid, email) {
		await db.setRemove('invitation:uid:' + uid, email);
		const count = await db.setCount('invitation:uid:' + uid);
		if (count === 0) {
			await db.setRemove('invitation:uids', uid);
		}
	}
};
