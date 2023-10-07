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

		const topicData = await topics.getTopicFields(postData.tid, [
			'cid', 'mainPid', 'title', 'timestamp', 'scheduled', 'slug', 'tags',
		]);

		await scheduledTopicCheck(data, topicData);

		const oldContent = postData.content; // for diffing purposes
		const editPostData = getEditPostData(data, topicData, postData);

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
		const contentChanged = data.content !== oldContent ||
			topic.renamed ||
			topic.tagsupdated;

		if (meta.config.enablePostHistory === 1 && contentChanged) {
			await Posts.diffs.save({
				pid: data.pid,
				uid: data.uid,
				oldContent: oldContent,
				newContent: data.content,
				edited: editPostData.edited,
				topic,
			});
		}
		await Posts.uploads.sync(data.pid);

		// Normalize data prior to constructing returnPostData (match types with getPostSummaryByPids)
		postData.deleted = !!postData.deleted;

		const returnPostData = { ...postData, ...result.post };
		returnPostData.cid = topic.cid;
		returnPostData.topic = topic;
		returnPostData.editedISO = utils.toISOString(editPostData.edited);
		returnPostData.changed = contentChanged;
		returnPostData.oldContent = oldContent;
		returnPostData.newContent = data.content;

		await topics.notifyFollowers(returnPostData, data.uid, {
			type: 'post-edit',
			bodyShort: translator.compile('notifications:user-edited-post', editor.username, topic.title),
			nid: `edit_post:${data.pid}:uid:${data.uid}`,
		});
		await topics.syncBacklinks(returnPostData);

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

		const isMain = parseInt(data.pid, 10) === parseInt(topicData.mainPid, 10);
		if (!isMain) {
			return {
				tid: tid,
				cid: topicData.cid,
				title: topicData.title,
				isMainPost: false,
				renamed: false,
				tagsupdated: false,
			};
		}

		const newTopicData = {
			tid: tid,
			cid: topicData.cid,
			uid: postData.uid,
			mainPid: data.pid,
			timestamp: rescheduling(data, topicData) ? data.timestamp : topicData.timestamp,
		};
		if (title) {
			newTopicData.title = title;
			newTopicData.slug = `${tid}/${slugify(title) || 'topic'}`;
		}

		const tagsupdated = Array.isArray(data.tags) &&
			!_.isEqual(data.tags, topicData.tags.map(tag => tag.value));

		if (tagsupdated) {
			const canTag = await privileges.categories.can('topics:tag', topicData.cid, data.uid);
			if (!canTag) {
				throw new Error('[[error:no-privileges]]');
			}
			await topics.validateTags(data.tags, topicData.cid, data.uid, tid);
		}

		const results = await plugins.hooks.fire('filter:topic.edit', {
			req: data.req,
			topic: newTopicData,
			data: data,
		});
		await db.setObject(`topic:${tid}`, results.topic);
		if (tagsupdated) {
			await topics.updateTopicTags(tid, data.tags);
		}
		const tags = await topics.getTopicTagsObjects(tid);

		if (rescheduling(data, topicData)) {
			await topics.scheduled.reschedule(newTopicData);
		}

		newTopicData.tags = data.tags;
		newTopicData.oldTitle = topicData.title;
		const renamed = title && translator.escape(validator.escape(String(title))) !== topicData.title;
		plugins.hooks.fire('action:topic.edit', { topic: newTopicData, uid: data.uid });
		return {
			tid: tid,
			cid: newTopicData.cid,
			uid: postData.uid,
			title: validator.escape(String(title)),
			oldTitle: topicData.title,
			slug: newTopicData.slug || topicData.slug,
			isMainPost: true,
			renamed: renamed,
			tagsupdated: tagsupdated,
			tags: tags,
			oldTags: topicData.tags,
			rescheduled: rescheduling(data, topicData),
		};
	}

	async function scheduledTopicCheck(data, topicData) {
		if (!topicData.scheduled) {
			return;
		}
		const canSchedule = await privileges.categories.can('topics:schedule', topicData.cid, data.uid);
		if (!canSchedule) {
			throw new Error('[[error:no-privileges]]');
		}
		const isMain = parseInt(data.pid, 10) === parseInt(topicData.mainPid, 10);
		if (isMain && isNaN(data.timestamp)) {
			throw new Error('[[error:invalid-data]]');
		}
	}

	function getEditPostData(data, topicData, postData) {
		const editPostData = {
			content: data.content,
			editor: data.uid,
		};

		// For posts in scheduled topics, if edited before, use edit timestamp
		editPostData.edited = topicData.scheduled ? (postData.edited || postData.timestamp) + 1 : Date.now();

		// if rescheduling the main post
		if (rescheduling(data, topicData)) {
			// For main posts, use timestamp coming from user (otherwise, it is ignored)
			editPostData.edited = data.timestamp;
			editPostData.timestamp = data.timestamp;
		}

		return editPostData;
	}

	function rescheduling(data, topicData) {
		const isMain = parseInt(data.pid, 10) === parseInt(topicData.mainPid, 10);
		return isMain && topicData.scheduled && topicData.timestamp !== data.timestamp;
	}
};
