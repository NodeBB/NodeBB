'use strict';

const _ = require('lodash');
const nconf = require('nconf');

const db = require('../../database');
const meta = require('../../meta');
const user = require('../../user');
const posts = require('../../posts');
const categories = require('../../categories');
const plugins = require('../../plugins');
const privileges = require('../../privileges');
const helpers = require('../helpers');
const accountHelpers = require('./helpers');
const utils = require('../../utils');

const profileController = module.exports;

const url = nconf.get('url');

profileController.get = async function (req, res, next) {
	const { userData } = res.locals;
	if (!userData) {
		return next();
	}

	await incrementProfileViews(req, userData);

	const [latestPosts, bestPosts, customUserFields] = await Promise.all([
		getLatestPosts(req.uid, userData),
		getBestPosts(req.uid, userData),
		accountHelpers.getCustomUserFields(req.uid, userData),
		posts.parseSignature(userData, req.uid),
	]);
	userData.customUserFields = customUserFields;
	userData.posts = latestPosts; // for backwards compat.
	userData.latestPosts = latestPosts;
	userData.bestPosts = bestPosts;
	userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username }]);
	userData.title = userData.username;

	// Show email changed modal on first access after said change
	userData.emailChanged = req.session.emailChanged;
	delete req.session.emailChanged;

	if (!userData.profileviews) {
		userData.profileviews = 1;
	}

	addTags(res, userData);

	if (meta.config.activitypubEnabled) {
		// Include link header for richer parsing
		res.set('Link', `<${nconf.get('url')}/uid/${userData.uid}>; rel="alternate"; type="application/activity+json"`);

		if (!utils.isNumber(userData.uid)) {
			res.set('Link', `<${userData.url || userData.uid}>; rel="canonical"`);
			res.set('x-robots-tag', 'noindex');
		}
	}

	res.render('account/profile', userData);
};

async function incrementProfileViews(req, userData) {
	if (req.uid >= 1) {
		req.session.uids_viewed = req.session.uids_viewed || {};

		if (
			req.uid !== userData.uid &&
			(!req.session.uids_viewed[userData.uid] || req.session.uids_viewed[userData.uid] < Date.now() - 3600000)
		) {
			await user.incrementUserFieldBy(userData.uid, 'profileviews', 1);
			req.session.uids_viewed[userData.uid] = Date.now();
		}
	}
}

async function getLatestPosts(callerUid, userData) {
	return await getPosts(callerUid, userData, 'pids');
}

async function getBestPosts(callerUid, userData) {
	return await getPosts(callerUid, userData, 'pids:votes');
}

async function getPosts(callerUid, userData, setSuffix) {
	const cids = await categories.getCidsByPrivilege('categories:cid', callerUid, 'topics:read');
	const keys = cids.map(c => `cid:${c}:uid:${userData.uid}:${setSuffix}`);
	let hasMorePosts = true;
	let start = 0;
	const count = 10;
	const postData = [];

	const [isAdmin, isModOfCids, canSchedule] = await Promise.all([
		user.isAdministrator(callerUid),
		user.isModerator(callerUid, cids),
		privileges.categories.isUserAllowedTo('topics:schedule', cids, callerUid),
	]);
	const isModOfCid = _.zipObject(cids, isModOfCids);
	const cidToCanSchedule = _.zipObject(cids, canSchedule);

	do {
		/* eslint-disable no-await-in-loop */
		let pids = await db.getSortedSetRevRange(keys, start, start + count - 1);
		if (!pids.length || pids.length < count) {
			hasMorePosts = false;
		}
		if (pids.length) {
			({ pids } = await plugins.hooks.fire('filter:account.profile.getPids', {
				uid: callerUid,
				userData,
				setSuffix,
				pids,
			}));
			const p = await posts.getPostSummaryByPids(pids, callerUid, { stripTags: false });
			postData.push(...p.filter(
				p => p && p.topic && (
					isAdmin ||
					isModOfCid[p.topic.cid] ||
					(p.topic.scheduled && cidToCanSchedule[p.topic.cid]) ||
					(!p.deleted && !p.topic.deleted)
				)
			));
		}
		start += count;
	} while (postData.length < count && hasMorePosts);
	return postData.slice(0, count);
}

function addTags(res, userData) {
	const plainAboutMe = userData.aboutme ? utils.stripHTMLTags(utils.decodeHTMLEntities(userData.aboutme)) : '';
	res.locals.metaTags = [
		{
			name: 'title',
			content: userData.fullname || userData.username,
			noEscape: true,
		},
		{
			name: 'description',
			content: plainAboutMe,
		},
		{
			property: 'og:title',
			content: userData.fullname || userData.username,
			noEscape: true,
		},
		{
			property: 'og:description',
			content: plainAboutMe,
		},
	];

	if (userData.picture) {
		res.locals.metaTags.push(
			{
				property: 'og:image',
				content: userData.picture,
				noEscape: true,
			},
			{
				property: 'og:image:url',
				content: userData.picture,
				noEscape: true,
			}
		);
	}

	res.locals.linkTags = [];

	if (utils.isNumber(userData.uid)) {
		res.locals.linkTags.push({
			rel: 'canonical',
			href: `${url}/user/${userData.userslug}`,
		});
	} else {
		res.locals.linkTags.push({
			rel: 'canonical',
			href: userData.url || userData.uid,
		});
		res.locals.metaTags.push({
			name: 'robots',
			content: 'noindex',
		});
	}

	if (meta.config.activitypubEnabled) {
		res.locals.linkTags.push({
			rel: 'alternate',
			type: 'application/activity+json',
			href: `${nconf.get('url')}/uid/${userData.uid}`,
		});
	}
}
