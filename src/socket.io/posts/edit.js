'use strict';

const validator = require('validator');
const _ = require('lodash');

const posts = require('../../posts');
const groups = require('../../groups');
const events = require('../../events');
const meta = require('../../meta');
const utils = require('../../utils');
const apiHelpers = require('../../api/helpers');
const websockets = require('../index');

module.exports = function (SocketPosts) {
	SocketPosts.edit = async function (socket, data) {
		websockets.warnDeprecated(socket, 'PUT /api/v3/posts/:pid');

		if (!socket.uid) {
			throw new Error('[[error:not-logged-in]]');
		} else if (!data || !data.pid || (meta.config.minimumPostLength !== 0 && !data.content)) {
			throw new Error('[[error:invalid-data]]');
		}

		// Trim and remove HTML (latter for composers that send in HTML, like redactor)
		var contentLen = utils.stripHTMLTags(data.content).trim().length;

		if (data.title && data.title.length < meta.config.minimumTitleLength) {
			throw new Error('[[error:title-too-short, ' + meta.config.minimumTitleLength + ']]');
		} else if (data.title && data.title.length > meta.config.maximumTitleLength) {
			throw new Error('[[error:title-too-long, ' + meta.config.maximumTitleLength + ']]');
		} else if (meta.config.minimumPostLength !== 0 && contentLen < meta.config.minimumPostLength) {
			throw new Error('[[error:content-too-short, ' + meta.config.minimumPostLength + ']]');
		} else if (contentLen > meta.config.maximumPostLength) {
			throw new Error('[[error:content-too-long, ' + meta.config.maximumPostLength + ']]');
		}

		data.uid = socket.uid;
		data.req = apiHelpers.buildReqObject(socket);

		const editResult = await posts.edit(data);
		if (editResult.topic.renamed) {
			await events.log({
				type: 'topic-rename',
				uid: socket.uid,
				ip: socket.ip,
				tid: editResult.topic.tid,
				oldTitle: validator.escape(String(editResult.topic.oldTitle)),
				newTitle: validator.escape(String(editResult.topic.title)),
			});
		}

		if (!editResult.post.deleted) {
			websockets.in('topic_' + editResult.topic.tid).emit('event:post_edited', editResult);
			return editResult.post;
		}

		const memberData = await groups.getMembersOfGroups([
			'administrators',
			'Global Moderators',
			'cid:' + editResult.topic.cid + ':privileges:moderate',
			'cid:' + editResult.topic.cid + ':privileges:groups:moderate',
		]);

		const uids = _.uniq(_.flatten(memberData).concat(socket.uid.toString()));
		uids.forEach(uid =>	websockets.in('uid_' + uid).emit('event:post_edited', editResult));
		return editResult.post;
	};
};
