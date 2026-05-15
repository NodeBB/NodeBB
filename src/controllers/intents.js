'use strict';

const posts = require('../posts');
const categories = require('../categories');
const helpers = require('./helpers');
const activitypub = require('../activitypub');
const utils = require('../utils');

const Intents = module.exports;

Intents.create = async (req, res, next) => {
	if (!req.uid) {
		req.session.returnTo = req.originalUrl;
		helpers.redirect(res, '/login');
	}

	const payload = {};

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
			console.log(toPid);
			// Local post ID — verify it exists
			const exists = await posts.exists(toPid);
			if (exists) {
				const tid = await posts.getPostField(toPid, 'tid');
				if (tid) {
					payload.tid = tid;
				}
			}
		} else {
			// Not a valid local post — assert as ActivityPub note
			const result = await activitypub.notes.assert(0, toPid);
			if (result && result.tid) {
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

	if (!['tid', 'cid'].some(prop => payload.hasOwnProperty(prop))) {
		return next();
	}

	res.render('intents/create', payload);
};