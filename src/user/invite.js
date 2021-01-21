
'use strict';

var async = require('async');
var nconf = require('nconf');
var validator = require('validator');

var db = require('../database');
var meta = require('../meta');
var emailer = require('../emailer');
var groups = require('../groups');
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

	User.sendInvitationEmail = async function (uid, email, groupsToJoin) {
		if (!uid) {
			throw new Error('[[error:invalid-uid]]');
		}

		const email_exists = await User.getUidByEmail(email);
		if (email_exists) {
			throw new Error('[[error:email-taken]]');
		}

		const invitation_exists = await db.exists('invitation:email:' + email);
		if (invitation_exists) {
			throw new Error('[[error:email-invited]]');
		}

		const data = await prepareInvitation(uid, email, groupsToJoin);
		await emailer.sendToEmail('invitation', email, meta.config.defaultLang, data);
	};

	User.verifyInvitation = async function (query) {
		if (!query.token || !query.email) {
			throw new Error('[[error:invalid-data]]');
		}
		const token = await db.getObjectField('invitation:email:' + query.email, 'token');
		if (!token || token !== query.token) {
			throw new Error('[[error:invalid-token]]');
		}
	};

	User.joinGroupsFromInvitation = async function (uid, email) {
		let groupsToJoin = await db.getObjectField('invitation:email:' + email, 'groupsToJoin');

		try {
			groupsToJoin = JSON.parse(groupsToJoin);
		} catch (e) {
			return;
		}

		if (!groupsToJoin || groupsToJoin.length < 1) {
			return;
		}

		await groups.join(groupsToJoin, uid);
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

	async function prepareInvitation(uid, email, groupsToJoin) {
		const inviterExists = await User.exists(uid);
		if (!inviterExists) {
			throw new Error('[[error:invalid-uid]]');
		}

		const token = utils.generateUUID();
		const registerLink = nconf.get('url') + '/register?token=' + token + '&email=' + encodeURIComponent(email);

		const expireDays = meta.config.inviteExpiration;
		const expireIn = expireDays * 86400000;

		await db.setAdd('invitation:uid:' + uid, email);
		await db.setAdd('invitation:uids', uid);
		await db.setObject('invitation:email:' + email, {
			token,
			groupsToJoin: JSON.stringify(groupsToJoin),
		});
		await db.pexpireAt('invitation:email:' + email, Date.now() + expireIn);

		const username = await User.getUserField(uid, 'username');
		const title = meta.config.title || meta.config.browserTitle || 'NodeBB';
		const subject = await translator.translate('[[email:invite, ' + title + ']]', meta.config.defaultLang);

		return {
			...emailer._defaultPayload, // Append default data to this email payload
			site_title: title,
			registerLink: registerLink,
			subject: subject,
			username: username,
			template: 'invitation',
			expireDays: expireDays,
		};
	}
};
