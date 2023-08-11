
'use strict';

const validator = require('validator');
const _ = require('lodash');

const topics = require('../topics');
const user = require('../user');
const plugins = require('../plugins');
const categories = require('../categories');
const utils = require('../utils');

module.exports = function (Posts) {
	Posts.getPostSummaryByPids = async function (pids, uid, options) {
		if (!Array.isArray(pids) || !pids.length) {
			return [];
		}

		options.stripTags = options.hasOwnProperty('stripTags') ? options.stripTags : false;
		options.parse = options.hasOwnProperty('parse') ? options.parse : true;
		options.extraFields = options.hasOwnProperty('extraFields') ? options.extraFields : [];

		const fields = ['pid', 'tid', 'content', 'uid', 'timestamp', 'deleted', 'upvotes', 'downvotes', 'replies', 'handle'].concat(options.extraFields);

		let posts = await Posts.getPostsFields(pids, fields);
		posts = posts.filter(Boolean);
		posts = await user.blocks.filter(uid, posts);

		const uids = _.uniq(posts.map(p => p && p.uid));
		const tids = _.uniq(posts.map(p => p && p.tid));

		const [users, topicsAndCategories] = await Promise.all([
			user.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture', 'status']),
			getTopicAndCategories(tids),
		]);

		const uidToUser = toObject('uid', users);
		const tidToTopic = toObject('tid', topicsAndCategories.topics);
		const cidToCategory = toObject('cid', topicsAndCategories.categories);

		posts.forEach((post) => {
			// If the post author isn't represented in the retrieved users' data,
			// then it means they were deleted, assume guest.
			if (!uidToUser.hasOwnProperty(post.uid)) {
				post.uid = 0;
			}
			post.user = uidToUser[post.uid];
			Posts.overrideGuestHandle(post, post.handle);
			post.handle = undefined;
			post.topic = tidToTopic[post.tid];
			post.category = post.topic && cidToCategory[post.topic.cid];
			post.isMainPost = post.topic && post.pid === post.topic.mainPid;
			post.deleted = post.deleted === 1;
			post.timestampISO = utils.toISOString(post.timestamp);
		});

		posts = posts.filter(post => tidToTopic[post.tid]);

		posts = await parsePosts(posts, options);
		const result = await plugins.hooks.fire('filter:post.getPostSummaryByPids', { posts: posts, uid: uid });
		return result.posts;
	};

	async function parsePosts(posts, options) {
		return await Promise.all(posts.map(async (post) => {
			if (!post.content || !options.parse) {
				post.content = post.content ? validator.escape(String(post.content)) : post.content;
				return post;
			}
			post = await Posts.parsePost(post);
			if (options.stripTags) {
				post.content = stripTags(post.content);
			}
			return post;
		}));
	}

	async function getTopicAndCategories(tids) {
		const topicsData = await topics.getTopicsFields(tids, [
			'uid', 'tid', 'title', 'cid', 'tags', 'slug',
			'deleted', 'scheduled', 'postcount', 'mainPid', 'teaserPid',
		]);

		const cids = _.uniq(topicsData.map(topic => topic && topic.cid));
		const categoriesData = await categories.getCategoriesFields(cids, [
			'cid', 'name', 'icon', 'slug', 'parentCid',
			'bgColor', 'color', 'backgroundImage', 'imageClass',
		]);

		return { topics: topicsData, categories: categoriesData };
	}

	function toObject(key, data) {
		const obj = {};
		for (let i = 0; i < data.length; i += 1) {
			obj[data[i][key]] = data[i];
		}
		return obj;
	}

	function stripTags(content) {
		if (content) {
			return utils.stripHTMLTags(content, utils.stripTags);
		}
		return content;
	}
};
