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
	pubsub.on('post:edit', (pid) => {
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

		const topicData = await topics.getTopicFields(postData.tid, ['cid', 'title', 'timestamp', 'scheduled']);
		const oldContent = postData.content; // for diffing purposes
		// For posts in scheduled topics, if edited before, use edit timestamp
		const postTimestamp = topicData.scheduled ? (postData.edited || postData.timestamp) + 1 : Date.now();
		const editPostData = {
			content: data.content,
			edited: postTimestamp,
			editor: data.uid,
		};
		if (data.handle) {
			editPostData.handle = data.handle;
		}

		const result = await plugins.hooks.fire('filter:post.edit', {
			req: data.req,
			post: editPostData,
			data: data,
			uid: data.uid,
		});

		const [editor, topic] = await Promise.all([
			user.getUserFields(data.uid, ['username', 'userslug']),
			editMainPost(data, postData, topicData),
		]);

		await Posts.setPostFields(data.pid, result.post);

		if (meta.config.enablePostHistory === 1) {
			await Posts.diffs.save({
				pid: data.pid,
				uid: data.uid,
				oldContent: oldContent,
				newContent: data.content,
				edited: postTimestamp,
			});
		}
		await Posts.uploads.sync(data.pid);

		// Normalize data prior to constructing returnPostData (match types with getPostSummaryByPids)
		postData.deleted = !!postData.deleted;

		const returnPostData = { ...postData, ...result.post };
		returnPostData.cid = topic.cid;
		returnPostData.topic = topic;
		returnPostData.editedISO = utils.toISOString(postTimestamp);
		returnPostData.changed = oldContent !== data.content;

		await topics.notifyFollowers(returnPostData, data.uid, {
			type: 'post-edit',
			bodyShort: translator.compile('notifications:user_edited_post', editor.username, topic.title),
			nid: `edit_post:${data.pid}:uid:${data.uid}`,
		});

		plugins.hooks.fire('action:post.edit', { post: _.clone(returnPostData), data: data, uid: data.uid });

		require('./cache').del(String(postData.pid));
		pubsub.publish('post:edit', String(postData.pid));

		await Posts.parsePost(returnPostData);

		return {
			topic: topic,
			editor: editor,
			post: returnPostData,
		};
	};

	async function editMainPost(data, postData, topicData) {
		const { tid } = postData;
		const title = data.title ? data.title.trim() : '';

		const isMain = await Posts.isMain(data.pid);
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
			newTopicData.slug = `${tid}/${slugify(title) || 'topic'}`;
		}

		data.tags = data.tags || [];

		if (data.tags.length) {
			const canTag = await privileges.categories.can('topics:tag', topicData.cid, data.uid);
			if (!canTag) {
				throw new Error('[[error:no-privileges]]');
			}
		}
		await topics.validateTags(data.tags, topicData.cid, data.uid);

		const results = await plugins.hooks.fire('filter:topic.edit', {
			req: data.req,
			topic: newTopicData,
			data: data,
		});
		await db.setObject(`topic:${tid}`, results.topic);
		await topics.updateTopicTags(tid, data.tags);
		const tags = await topics.getTopicTagsObjects(tid);

		newTopicData.tags = data.tags;
		newTopicData.oldTitle = topicData.title;
		newTopicData.timestamp = topicData.timestamp;
		const renamed = translator.escape(validator.escape(String(title))) !== topicData.title;
		plugins.hooks.fire('action:topic.edit', { topic: newTopicData, uid: data.uid });
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
