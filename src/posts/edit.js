'use strict';

const validator = require('validator');
const _ = require('lodash');

const db = require('../database');
const meta = require('../meta');
const topics = require('../topics');
const user = require('../user');
const privileges = require('../privileges');
const plugins = require('../plugins');
const pubsub = require('../pubsub');
const utils = require('../utils');
const slugify = require('../slugify');
const translator = require('../translator');

module.exports = function (Posts) {
	pubsub.on('post:edit', function (pid) {
		require('./cache').del(pid);
	});

	Posts.edit = async function (data) {
		const canEdit = await privileges.posts.canEdit(data.pid, data.uid);
		if (!canEdit.flag) {
			throw new Error(canEdit.message);
		}
		const postData = await Posts.getPostData(data.pid);
		if (!postData) {
			throw new Error('[[error:no-post]]');
		}

		const oldContent = postData.content; // for diffing purposes
		const now = Date.now();
		const editPostData = {
			content: data.content,
			edited: now,
			editor: data.uid,
		};
		if (data.handle) {
			editPostData.handle = data.handle;
		}

		const result = await plugins.fireHook('filter:post.edit', {
			req: data.req,
			post: editPostData,
			data: data,
			uid: data.uid,
		});

		const [editor, topic] = await Promise.all([
			user.getUserFields(data.uid, ['username', 'userslug']),
			editMainPost(data, postData),
		]);

		await Posts.setPostFields(data.pid, result.post);

		if (meta.config.enablePostHistory === 1) {
			await Posts.diffs.save({
				pid: data.pid,
				uid: data.uid,
				oldContent: oldContent,
				newContent: data.content,
			});
		}
		await Posts.uploads.sync(data.pid);

		// Normalize data prior to constructing returnPostData (match types with getPostSummaryByPids)
		postData.deleted = !!postData.deleted;

		const returnPostData = { ...postData, ...result.post };
		returnPostData.cid = topic.cid;
		returnPostData.topic = topic;
		returnPostData.editedISO = utils.toISOString(now);
		returnPostData.changed = oldContent !== data.content;

		await topics.notifyFollowers(returnPostData, data.uid, {
			type: 'post-edit',
			bodyShort: translator.compile('notifications:user_edited_post', editor.username, topic.title),
			nid: 'edit_post:' + data.pid + ':uid:' + data.uid,
		});

		plugins.fireHook('action:post.edit', { post: _.clone(returnPostData), data: data, uid: data.uid });

		require('./cache').del(String(postData.pid));
		pubsub.publish('post:edit', String(postData.pid));

		await Posts.parsePost(returnPostData);

		return {
			topic: topic,
			editor: editor,
			post: returnPostData,
		};
	};

	async function editMainPost(data, postData) {
		const tid = postData.tid;
		const title = data.title ? data.title.trim() : '';

		const [topicData, isMain] = await Promise.all([
			topics.getTopicFields(tid, ['cid', 'title', 'timestamp']),
			Posts.isMain(data.pid),
		]);

		if (!isMain) {
			return {
				tid: tid,
				cid: topicData.cid,
				title: validator.escape(String(topicData.title)),
				isMainPost: false,
				renamed: false,
			};
		}

		const newTopicData = {
			tid: tid,
			cid: topicData.cid,
			uid: postData.uid,
			mainPid: data.pid,
		};
		if (title) {
			newTopicData.title = title;
			newTopicData.slug = tid + '/' + (slugify(title) || 'topic');
		}
		newTopicData.thumb = data.thumb || '';

		data.tags = data.tags || [];

		if (data.tags.length) {
			const canTag = await privileges.categories.can('topics:tag', topicData.cid, data.uid);
			if (!canTag) {
				throw new Error('[[error:no-privileges]]');
			}
		}
		await topics.validateTags(data.tags, topicData.cid);

		const results = await plugins.fireHook('filter:topic.edit', {
			req: data.req,
			topic: newTopicData,
			data: data,
		});
		await db.setObject('topic:' + tid, results.topic);
		await topics.updateTopicTags(tid, data.tags);
		const tags = await topics.getTopicTagsObjects(tid);

		newTopicData.tags = data.tags;
		newTopicData.oldTitle = topicData.title;
		newTopicData.timestamp = topicData.timestamp;
		const renamed = translator.escape(validator.escape(String(title))) !== topicData.title;
		plugins.fireHook('action:topic.edit', { topic: newTopicData, uid: data.uid });
		return {
			tid: tid,
			cid: newTopicData.cid,
			uid: postData.uid,
			title: validator.escape(String(title)),
			oldTitle: topicData.title,
			slug: newTopicData.slug,
			isMainPost: true,
			renamed: renamed,
			tags: tags,
		};
	}
};
