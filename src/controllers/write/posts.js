'use strict';

const validator = require('validator');
const _ = require('lodash');

const meta = require('../../meta');
const groups = require('../../groups');
const posts = require('../../posts');
const events = require('../../events');
const utils = require('../../utils');

const helpers = require('../helpers');
const sockets = require('../../socket.io');

const Posts = module.exports;

Posts.edit = async (req, res) => {
	if (meta.config.minimumPostLength !== 0 && !req.body.content) {
		throw new Error('[[error:invalid-data]]');
	}

	// Trim and remove HTML (latter for composers that send in HTML, like redactor)
	var contentLen = utils.stripHTMLTags(req.body.content).trim().length;

	if (req.body.title && req.body.title.length < meta.config.minimumTitleLength) {
		throw new Error('[[error:title-too-short, ' + meta.config.minimumTitleLength + ']]');
	} else if (req.body.title && req.body.title.length > meta.config.maximumTitleLength) {
		throw new Error('[[error:title-too-long, ' + meta.config.maximumTitleLength + ']]');
	} else if (meta.config.minimumPostLength !== 0 && contentLen < meta.config.minimumPostLength) {
		throw new Error('[[error:content-too-short, ' + meta.config.minimumPostLength + ']]');
	} else if (contentLen > meta.config.maximumPostLength) {
		throw new Error('[[error:content-too-long, ' + meta.config.maximumPostLength + ']]');
	}

	// Payload construction
	var payload = {
		req,
		uid: req.user.uid,
		pid: req.params.pid,
		content: req.body.content,
		options: {},
	};
	['handle', 'title'].forEach((prop) => {
		if (req.body.hasOwnProperty(prop)) {
			payload[prop] = req.body[prop];
		}
	});
	['topic_thumb', 'tags'].forEach((prop) => {
		if (req.body.hasOwnProperty(prop)) {
			payload.options[prop] = req.body[prop];
		}
	});

	const editResult = await posts.edit(payload);
	helpers.formatApiResponse(200, res, await posts.getPostSummaryByPids([editResult.pid], req.user.uid, {}));

	if (editResult.topic.renamed) {
		await events.log({
			type: 'topic-rename',
			uid: req.user.uid,
			ip: req.ip,
			tid: editResult.topic.tid,
			oldTitle: validator.escape(String(editResult.topic.oldTitle)),
			newTitle: validator.escape(String(editResult.topic.title)),
		});
	}

	if (!editResult.post.deleted) {
		sockets.in('topic_' + editResult.topic.tid).emit('event:post_edited', editResult);
	}

	const memberData = await groups.getMembersOfGroups([
		'administrators',
		'Global Moderators',
		'cid:' + editResult.topic.cid + ':privileges:moderate',
		'cid:' + editResult.topic.cid + ':privileges:groups:moderate',
	]);

	const uids = _.uniq(_.flatten(memberData).concat(req.user.uid.toString()));
	uids.forEach(uid =>	sockets.in('uid_' + uid).emit('event:post_edited', editResult));
};
