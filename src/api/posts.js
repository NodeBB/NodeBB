'use strict';

const validator = require('validator');
const _ = require('lodash');

const utils = require('../utils');
const posts = require('../posts');
const groups = require('../groups');
const meta = require('../meta');
const events = require('../events');
const apiHelpers = require('./helpers');
const websockets = require('../socket.io');

const postsAPI = module.exports;

postsAPI.edit = async function (caller, data) {
	if (!data || !data.pid || (meta.config.minimumPostLength !== 0 && !data.content)) {
		throw new Error('[[error:invalid-data]]');
	}
	// Trim and remove HTML (latter for composers that send in HTML, like redactor)
	const contentLen = utils.stripHTMLTags(data.content).trim().length;

	if (data.title && data.title.length < meta.config.minimumTitleLength) {
		throw new Error('[[error:title-too-short, ' + meta.config.minimumTitleLength + ']]');
	} else if (data.title && data.title.length > meta.config.maximumTitleLength) {
		throw new Error('[[error:title-too-long, ' + meta.config.maximumTitleLength + ']]');
	} else if (meta.config.minimumPostLength !== 0 && contentLen < meta.config.minimumPostLength) {
		throw new Error('[[error:content-too-short, ' + meta.config.minimumPostLength + ']]');
	} else if (contentLen > meta.config.maximumPostLength) {
		throw new Error('[[error:content-too-long, ' + meta.config.maximumPostLength + ']]');
	}

	data.uid = caller.uid;
	data.req = apiHelpers.buildReqObject(caller);

	const editResult = await posts.edit(data);
	if (editResult.topic.renamed) {
		await events.log({
			type: 'topic-rename',
			uid: caller.uid,
			ip: caller.ip,
			tid: editResult.topic.tid,
			oldTitle: validator.escape(String(editResult.topic.oldTitle)),
			newTitle: validator.escape(String(editResult.topic.title)),
		});
	}
	const postObj = await posts.getPostSummaryByPids([editResult.post.pid], caller.uid, {});
	const returnData = { ...postObj[0], ...editResult.post };

	if (!editResult.post.deleted) {
		websockets.in('topic_' + editResult.topic.tid).emit('event:post_edited', editResult);
		return returnData;
	}

	const memberData = await groups.getMembersOfGroups([
		'administrators',
		'Global Moderators',
		'cid:' + editResult.topic.cid + ':privileges:moderate',
		'cid:' + editResult.topic.cid + ':privileges:groups:moderate',
	]);

	const uids = _.uniq(_.flatten(memberData).concat(String(caller.uid)));
	uids.forEach(uid =>	websockets.in('uid_' + uid).emit('event:post_edited', editResult));
	return returnData;
};
