'use strict';

const nconf = require('nconf');
const _ = require('lodash');

const db = require('../../database');
const user = require('../../user');
const posts = require('../../posts');
const categories = require('../../categories');
const meta = require('../../meta');
const accountHelpers = require('./helpers');
const helpers = require('../helpers');
const utils = require('../../utils');

const profileController = module.exports;

profileController.get = async function (req, res, next) {
	const lowercaseSlug = req.params.userslug.toLowerCase();

	if (req.params.userslug !== lowercaseSlug) {
		if (res.locals.isAPI) {
			req.params.userslug = lowercaseSlug;
		} else {
			return res.redirect(`${nconf.get('relative_path')}/user/${lowercaseSlug}`);
		}
	}

	const userData = await accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid);
	if (!userData) {
		return next();
	}

	await incrementProfileViews(req, userData);

	const [latestPosts, bestPosts] = await Promise.all([
		getLatestPosts(req.uid, userData),
		getBestPosts(req.uid, userData),
		posts.parseSignature(userData, req.uid),
	]);

	if (meta.config['reputation:disabled']) {
		delete userData.reputation;
	}

	userData.posts = latestPosts; // for backwards compat.
	userData.latestPosts = latestPosts;
	userData.bestPosts = bestPosts;
	userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username }]);
	userData.title = userData.username;
	userData.allowCoverPicture = !userData.isSelf || !!meta.config['reputation:disabled'] || userData.reputation >= meta.config['min:rep:cover-picture'];

	if (!userData.profileviews) {
		userData.profileviews = 1;
	}

	addMetaTags(res, userData);

	userData.selectedGroup = userData.groups.filter(group => group && userData.groupTitleArray.includes(group.name))
		.sort((a, b) => userData.groupTitleArray.indexOf(a.name) - userData.groupTitleArray.indexOf(b.name));

	res.render('account/profile', userData);
};

async function incrementProfileViews(req, userData) {
	if (req.uid >= 1) {
		req.session.uids_viewed = req.session.uids_viewed || {};

		if (req.uid !== userData.uid && (!req.session.uids_viewed[userData.uid] || req.session.uids_viewed[userData.uid] < Date.now() - 3600000)) {
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

	const [isAdmin, isModOfCids] = await Promise.all([
		user.isAdministrator(callerUid),
		user.isModerator(callerUid, cids),
	]);
	const cidToIsMod = _.zipObject(cids, isModOfCids);

	do {
		/* eslint-disable no-await-in-loop */
		const pids = await db.getSortedSetRevRange(keys, start, start + count - 1);
		if (!pids.length || pids.length < count) {
			hasMorePosts = false;
		}
		if (pids.length) {
			const p = await posts.getPostSummaryByPids(pids, callerUid, { stripTags: false });
			postData.push(...p.filter(p => p && p.topic && (isAdmin || cidToIsMod[p.topic.cid] || (!p.deleted && !p.topic.deleted))));
		}
		start += count;
	} while (postData.length < count && hasMorePosts);
	return postData.slice(0, count);
}

function addMetaTags(res, userData) {
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
}
