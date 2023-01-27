'use strict';

const db = require('../../database');
const user = require('../../user');
const helpers = require('../helpers');
const pagination = require('../../pagination');

const infoController = module.exports;

infoController.get = async function (req, res) {
	const page = Math.max(1, req.query.page || 1);
	const itemsPerPage = 10;
	const start = (page - 1) * itemsPerPage;
	const stop = start + itemsPerPage - 1;

	const [{ username, userslug }, isPrivileged] = await Promise.all([
		user.getUserFields(res.locals.uid, ['username', 'userslug']),
		user.isPrivileged(req.uid),
	]);
	const [history, sessions, usernames, emails, notes] = await Promise.all([
		user.getModerationHistory(res.locals.uid),
		user.auth.getSessions(res.locals.uid, req.sessionID),
		user.getHistory(`user:${res.locals.uid}:usernames`),
		user.getHistory(`user:${res.locals.uid}:emails`),
		getNotes({ uid: res.locals.uid, isPrivileged }, start, stop),
	]);

	const payload = {};

	payload.history = history;
	payload.sessions = sessions;
	payload.usernames = usernames;
	payload.emails = emails;

	if (isPrivileged) {
		payload.moderationNotes = notes.notes;
		const pageCount = Math.ceil(notes.count / itemsPerPage);
		payload.pagination = pagination.create(page, pageCount, req.query);
	}
	payload.title = '[[pages:account/info]]';
	payload.breadcrumbs = helpers.buildBreadcrumbs([{ text: username, url: `/user/${userslug}` }, { text: '[[user:account_info]]' }]);

	res.render('account/info', payload);
};

async function getNotes({ uid, isPrivileged }, start, stop) {
	if (!isPrivileged) {
		return;
	}
	const [notes, count] = await Promise.all([
		user.getModerationNotes(uid, start, stop),
		db.sortedSetCard(`uid:${uid}:moderation:notes`),
	]);
	return { notes: notes, count: count };
}
