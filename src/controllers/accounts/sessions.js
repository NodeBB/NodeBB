'use strict';

const util = require('util');

const db = require('../../database');
const user = require('../../user');
const helpers = require('../helpers');
const accountHelpers = require('./helpers');

const sessionController = module.exports;

sessionController.get = async function (req, res, next) {
	const userData = await accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid);
	if (!userData) {
		return next();
	}

	userData.sessions = await user.auth.getSessions(userData.uid, req.sessionID);
	userData.title = '[[pages:account/sessions]]';
	userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: '/user/' + userData.userslug }, { text: '[[pages:account/sessions]]' }]);

	res.render('account/sessions', userData);
};

const getSessionAsync = util.promisify(function (sid, callback) {
	db.sessionStore.get(sid, (err, sessionObj) => callback(err, sessionObj || null));
});

sessionController.revoke = async function (req, res, next) {
	if (!req.params.hasOwnProperty('uuid')) {
		return next();
	}
	try {
		const uid = await user.getUidByUserslug(req.params.userslug);
		if (!uid) {
			throw new Error('[[error:no-session-found]]');
		}
		const sids = await db.getSortedSetRange('uid:' + uid + ':sessions', 0, -1);
		let _id;
		for (const sid of sids) {
			/* eslint-disable no-await-in-loop */
			const sessionObj = await getSessionAsync(sid);
			if (sessionObj && sessionObj.meta && sessionObj.meta.uuid === req.params.uuid) {
				_id = sid;
				break;
			}
		}

		if (!_id) {
			throw new Error('[[error:no-session-found]]');
		}

		await user.auth.revokeSession(_id, uid);
	} catch (err) {
		return res.status(500).send(err.message);
	}

	res.sendStatus(200);
};
