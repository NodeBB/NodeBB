'use strict';

const nconf = require('nconf');

const db = require('../../database');
const user = require('../../user');
const posts = require('../../posts');
const categories = require('../../categories');
const plugins = require('../../plugins');
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
			return res.redirect(nconf.get('relative_path') + '/user/' + lowercaseSlug);
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

	const results = await plugins.fireHook('filter:user.account', { userData: userData, uid: req.uid });
	res.render('account/profile', results.userData);
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
	const keys = cids.map(c => 'cid:' + c + ':uid:' + userData.uid + ':' + setSuffix);
	const pids = await db.getSortedSetRevRange(keys, 0, 9);
	const postData = await posts.getPostSummaryByPids(pids, callerUid, { stripTags: false });
	return postData.filter(p => p && !p.deleted && p.topic && !p.topic.deleted);
}

function addMetaTags(res, userData) {
	var plainAboutMe = userData.aboutme ? utils.stripHTMLTags(utils.decodeHTMLEntities(userData.aboutme)) : '';
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
