'use strict';

import _ from 'lodash';
import db from '../database';
import utils from '../utils';
import user from '../user';
import privileges from '../privileges';
import plugins from '../plugins';

const Posts = {} as any;

import data from './data';
import create from './create';
import deletePost from './delete';
import edit from './edit';
import parse from './parse';
import topics from './topics';
import category from './category';
import summary from './summary';
import recent from './recent';
import tools from './tools';
import bookmarks from './bookmarks';
import queue from './queue';
import diffs from './diffs';
import uploads from './uploads';
import votes from './votes';

data(Posts);
create(Posts);
deletePost(Posts);
edit(Posts);
parse(Posts);
user(Posts);
topics(Posts);
category(Posts);
summary(Posts);
recent(Posts);
tools(Posts);
votes(Posts);
bookmarks(Posts);
queue(Posts);
diffs(Posts);
uploads(Posts);

Posts.exists = async function (pids) {
	return await db.exists(
		Array.isArray(pids) ? pids.map(pid => `post:${pid}`) : `post:${pids}`
	);
};

Posts.getPidsFromSet = async function (set, start, stop, reverse) {
	if (isNaN(start) || isNaN(stop)) {
		return [];
	}
	return await db[reverse ? 'getSortedSetRevRange' : 'getSortedSetRange'](set, start, stop);
};

Posts.getPostsByPids = async function (pids, uid) {
	if (!Array.isArray(pids) || !pids.length) {
		return [];
	}
	let posts = await Posts.getPostsData(pids);
	posts = await Promise.all(posts.map(Posts.parsePost));
	const data = await plugins.hooks.fire('filter:post.getPosts', { posts: posts, uid: uid });
	if (!data || !Array.isArray(data.posts)) {
		return [];
	}
	return data.posts.filter(Boolean);
};

Posts.getPostSummariesFromSet = async function (set, uid, start, stop) {
	let pids = await db.getSortedSetRevRange(set, start, stop);
	pids = await privileges.posts.filter('topics:read', pids, uid);
	const posts = await Posts.getPostSummaryByPids(pids, uid, { stripTags: false });
	return { posts: posts, nextStart: stop + 1 };
};

Posts.getPidIndex = async function (pid, tid, topicPostSort) {
	const set = topicPostSort === 'most_votes' ? `tid:${tid}:posts:votes` : `tid:${tid}:posts`;
	const reverse = topicPostSort === 'newest_to_oldest' || topicPostSort === 'most_votes';
	const index = await db[reverse ? 'sortedSetRevRank' : 'sortedSetRank'](set, pid);
	if (!utils.isNumber(index)) {
		return 0;
	}
	return utils.isNumber(index) ? parseInt(index, 10) + 1 : 0;
};

Posts.getPostIndices = async function (posts, uid) {
	if (!Array.isArray(posts) || !posts.length) {
		return [];
	}
	const settings = await user.getSettings(uid);

	const byVotes = settings.topicPostSort === 'most_votes';
	let sets = posts.map(p => (byVotes ? `tid:${p.tid}:posts:votes` : `tid:${p.tid}:posts`));
	const reverse = settings.topicPostSort === 'newest_to_oldest' || settings.topicPostSort === 'most_votes';

	const uniqueSets = _.uniq(sets);
	let method = reverse ? 'sortedSetsRevRanks' : 'sortedSetsRanks';
	if (uniqueSets.length === 1) {
		method = reverse ? 'sortedSetRevRanks' : 'sortedSetRanks';
		sets = uniqueSets[0];
	}

	const pids = posts.map(post => post.pid);
	const indices = await db[method](sets, pids);
	return indices.map(index => (utils.isNumber(index) ? parseInt(index, 10) + 1 : 0));
};

Posts.modifyPostByPrivilege = function (post, privileges) {
	if (post && post.deleted && !(post.selfPost || privileges['posts:view_deleted'])) {
		post.content = '[[topic:post_is_deleted]]';
		if (post.user) {
			post.user.signature = '';
		}
	}
};

import promisify from '../promisify';
promisify(Posts);

export default Posts;