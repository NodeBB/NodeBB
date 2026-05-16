'use strict';

const posts = require('../posts');
const categories = require('../categories');
const user = require('../user');
const helpers = require('./helpers');
const activitypub = require('../activitypub');
const utils = require('../utils');

const Intents = module.exports;

Intents.create = async (req, res, next) => {
	if (!req.uid) {
		req.session.returnTo = req.originalUrl;
		helpers.redirect(res, '/login');
	}

	const intent = req.params?.intent || 'create';
	const payload = { intent };

	switch (intent) {
		case 'create': {
			if (req.query?.toPid) {
				let { toPid } = req.query;

				if (!utils.isNumber(toPid)) {
					const resolved = await activitypub.helpers.resolveLocalId(toPid);
					const { type, id: localId } = resolved || {};
					if (type === 'post') {
						toPid = localId || toPid;
					}
				}

				if (utils.isNumber(toPid)) {
					// Local post ID — verify it exists
					const exists = await posts.exists(toPid);
					if (exists) {
						const tid = await posts.getPostField(toPid, 'tid');
						if (tid) {
							payload.toPid = parseInt(toPid, 10);
							payload.tid = tid;
						}
					}
				} else {
					// Not a valid local post — assert as ActivityPub note
					const result = await activitypub.notes.assert(0, toPid);
					if (result && result.tid) {
						payload.toPid = toPid;
						payload.tid = result.tid;
					}
				}
			} else if (req.query?.cid) {
				let { cid } = req.query;

				if (!utils.isNumber(cid)) {
					const resolved = await activitypub.helpers.resolveLocalId(cid);
					const { type, id: localId } = resolved || {};
					if (type === 'category') {
						cid = localId || cid;
					}
				}

				// Verify category exists
				const exists = await categories.exists(cid);
				if (!exists) {
					return next();
				}
				payload.cid = cid;
			}

			if (!['toPid', 'tid', 'cid'].some(prop => payload.hasOwnProperty(prop))) {
				return next();
			}
			break;
		}

		case 'like':
		case 'dislike': {
			let { pid } = req.query;

			if (!utils.isNumber(pid)) {
				const resolved = await activitypub.helpers.resolveLocalId(pid);
				const { type, id: localId } = resolved || {};
				if (type === 'post') {
					pid = localId || pid;
				}
			}

			const exists = await posts.exists(pid);
			if (exists) {
				payload.pid = pid;
			} else if (!utils.isNumber(pid)) {
				const assertion = await activitypub.notes.assert(req.uid, pid);
				if (!assertion) {
					return next();
				}

				payload.pid = pid;
			} else {
				throw new Error('[[error:invalid-pid]]');
			}
			break;
		}

		case 'follow': {
			let { uid } = req.query;

			if (!utils.isNumber(uid)) {
				const resolved = await activitypub.helpers.resolveLocalId(uid);
				const { type, id: localId } = resolved || {};
				if (type === 'user') {
					uid = localId || uid;
				}
			}

			const exists = await user.exists(uid);
			if (exists) {
				payload.uid = uid;
			} else if (!utils.isNumber(uid)) {
				const assertion = await activitypub.actors.assert([uid]);
				if (!assertion) {
					return next();
				}
				payload.uid = uid;
			} else {
				throw new Error('[[error:invalid-uid]]');
			}
			break;
		}

		default:
			return next();
	}

	res.render('intents', payload);

};