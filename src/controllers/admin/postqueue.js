'use strict';

const validator = require('validator');

const db = require('../../database');
const user = require('../../user');
const topics = require('../../topics');
const categories = require('../../categories');
const pagination = require('../../pagination');
const plugins = require('../../plugins');
const utils = require('../../utils');

const postQueueController = module.exports;

postQueueController.get = async function (req, res) {
	const page = parseInt(req.query.page, 10) || 1;
	const postsPerPage = 20;

	const [ids, isAdminOrGlobalMod, moderatedCids] = await Promise.all([
		db.getSortedSetRange('post:queue', 0, -1),
		user.isAdminOrGlobalMod(req.uid),
		user.getModeratedCids(req.uid),
	]);

	let postData = await getQueuedPosts(ids);
	postData = postData.filter(p => p && (isAdminOrGlobalMod || moderatedCids.includes(String(p.category.cid))));

	const pageCount = Math.max(1, Math.ceil(postData.length / postsPerPage));
	const start = (page - 1) * postsPerPage;
	const stop = start + postsPerPage - 1;
	postData = postData.slice(start, stop + 1);

	res.render('admin/manage/post-queue', {
		title: '[[pages:post-queue]]',
		posts: postData,
		pagination: pagination.create(page, pageCount),
	});
};

async function getQueuedPosts(ids) {
	const keys = ids.map(id => 'post:queue:' + id);
	const postData = await db.getObjects(keys);
	postData.forEach(function (data) {
		if (data) {
			data.data = JSON.parse(data.data);
			data.data.timestampISO = utils.toISOString(data.data.timestamp);
		}
	});
	const uids = postData.map(data => data && data.uid);
	const userData = await user.getUsersFields(uids, ['username', 'userslug', 'picture']);
	postData.forEach(function (postData, index) {
		if (postData) {
			postData.user = userData[index];
			postData.data.rawContent = validator.escape(String(postData.data.content));
			postData.data.title = validator.escape(String(postData.data.title || ''));
		}
	});

	await Promise.all(postData.map(p => addMetaData(p)));
	return postData;
}

async function addMetaData(postData) {
	if (!postData) {
		return;
	}
	postData.topic = { cid: 0 };
	if (postData.data.cid) {
		postData.topic = { cid: postData.data.cid };
	} else if (postData.data.tid) {
		postData.topic = await topics.getTopicFields(postData.data.tid, ['title', 'cid']);
	}
	postData.category = await categories.getCategoryData(postData.topic.cid);
	const result = await plugins.fireHook('filter:parse.post', { postData: postData.data });
	postData.data.content = result.postData.content;
}
