'use strict';

var async = require('async');
var validator = require('validator');
var _ = require('lodash');

var posts = require('../../posts');
var groups = require('../../groups');
var events = require('../../events');
var meta = require('../../meta');
var utils = require('../../utils');
var websockets = require('../index');

module.exports = function (SocketPosts) {
	SocketPosts.edit = function (socket, data, callback) {
		if (!socket.uid) {
			return callback(new Error('[[error:not-logged-in]]'));
		} else if (!data || !data.pid || (meta.config.minimumPostLength !== 0 && !data.content)) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		// Trim and remove HTML (latter for composers that send in HTML, like redactor)
		var contentLen = utils.stripHTMLTags(data.content).trim().length;

		if (data.title && data.title.length < meta.config.minimumTitleLength) {
			return callback(new Error('[[error:title-too-short, ' + meta.config.minimumTitleLength + ']]'));
		} else if (data.title && data.title.length > meta.config.maximumTitleLength) {
			return callback(new Error('[[error:title-too-long, ' + meta.config.maximumTitleLength + ']]'));
		} else if (data.tags && data.tags.length < meta.config.minimumTagsPerTopic) {
			return callback(new Error('[[error:not-enough-tags, ' + meta.config.minimumTagsPerTopic + ']]'));
		} else if (data.tags && data.tags.length > meta.config.maximumTagsPerTopic) {
			return callback(new Error('[[error:too-many-tags, ' + meta.config.maximumTagsPerTopic + ']]'));
		} else if (meta.config.minimumPostLength !== 0 && contentLen < meta.config.minimumPostLength) {
			return callback(new Error('[[error:content-too-short, ' + meta.config.minimumPostLength + ']]'));
		} else if (contentLen > meta.config.maximumPostLength) {
			return callback(new Error('[[error:content-too-long, ' + meta.config.maximumPostLength + ']]'));
		}

		data.uid = socket.uid;
		data.req = websockets.reqFromSocket(socket);

		var editResult;
		async.waterfall([
			function (next) {
				posts.edit(data, next);
			},
			function (result, next) {
				editResult = result;
				if (result.topic.renamed) {
					events.log({
						type: 'topic-rename',
						uid: socket.uid,
						ip: socket.ip,
						tid: result.topic.tid,
						oldTitle: validator.escape(String(result.topic.oldTitle)),
						newTitle: validator.escape(String(result.topic.title)),
					});
				}

				if (!result.post.deleted) {
					websockets.in('topic_' + result.topic.tid).emit('event:post_edited', result);
					return callback(null, result.post);
				}

				groups.getMembersOfGroups([
					'administrators',
					'Global Moderators',
					'cid:' + result.topic.cid + ':privileges:moderate',
					'cid:' + result.topic.cid + ':privileges:groups:moderate',
				], next);
			},
			function (results, next) {
				var uids = _.uniq(_.flatten(results).concat(socket.uid.toString()));
				uids.forEach(function (uid) {
					websockets.in('uid_' + uid).emit('event:post_edited', editResult);
				});
				next(null, editResult.post);
			},
		], callback);
	};
};
