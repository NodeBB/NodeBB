'use strict';

var _ = require('lodash');

var meta = require('../meta');
var db = require('../database');
var plugins = require('../plugins');
var user = require('../user');
var topics = require('../topics');
var categories = require('../categories');
var groups = require('../groups');
var utils = require('../utils');

module.exports = function (Posts) {
	Posts.create = async function (data) {
		// This is an internal method, consider using Topics.reply instead
		const uid = data.uid;
		const tid = data.tid;
		const content = data.content.toString();
		const timestamp = data.timestamp || Date.now();
		const isMain = data.isMain || false;

		if (!uid && parseInt(uid, 10) !== 0) {
			throw new Error('[[error:invalid-uid]]');
		}

		if (data.toPid && !utils.isNumber(data.toPid)) {
			throw new Error('[[error:invalid-pid]]');
		}

		const pid = await db.incrObjectField('global', 'nextPid');
		let postData = {
			pid: pid,
			uid: uid,
			tid: tid,
			content: content,
			timestamp: timestamp,
		};

		if (data.toPid) {
			postData.toPid = data.toPid;
		}
		if (data.ip && meta.config.trackIpPerPost) {
			postData.ip = data.ip;
		}
		if (data.handle && !parseInt(uid, 10)) {
			postData.handle = data.handle;
		}

		let result = await plugins.hooks.fire('filter:post.create', { post: postData, data: data });
		postData = result.post;
		await db.setObject('post:' + postData.pid, postData);

		const topicData = await topics.getTopicFields(tid, ['cid', 'pinned']);
		postData.cid = topicData.cid;

		await Promise.all([
			db.sortedSetAdd('posts:pid', timestamp, postData.pid),
			db.incrObjectField('global', 'postCount'),
			user.onNewPostMade(postData),
			topics.onNewPostMade(postData),
			categories.onNewPostMade(topicData.cid, topicData.pinned, postData),
			groups.onNewPostMade(postData),
			addReplyTo(postData, timestamp),
			Posts.uploads.sync(postData.pid),
		]);

		result = await plugins.hooks.fire('filter:post.get', { post: postData, uid: data.uid });
		result.post.isMain = isMain;
		plugins.hooks.fire('action:post.save', { post: _.clone(result.post) });
		return result.post;
	};

	async function addReplyTo(postData, timestamp) {
		if (!postData.toPid) {
			return;
		}
		await Promise.all([
			db.sortedSetAdd('pid:' + postData.toPid + ':replies', timestamp, postData.pid),
			db.incrObjectField('post:' + postData.toPid, 'replies'),
		]);
	}
};
