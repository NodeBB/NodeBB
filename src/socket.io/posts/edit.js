'use strict';

var async = require('async');
var winston = require('winston');

var posts = require('../../posts');
var groups = require('../../groups');
var events = require('../../events');
var meta = require('../../meta');
var websockets = require('../index');

module.exports = function(SocketPosts) {

	SocketPosts.edit = function(socket, data, callback) {
		if (!socket.uid) {
			return callback(new Error('[[error:not-logged-in]]'));
		} else if (!data || !data.pid || !data.content) {
			return callback(new Error('[[error:invalid-data]]'));
		} else if (data.title && data.title.length < parseInt(meta.config.minimumTitleLength, 10)) {
			return callback(new Error('[[error:title-too-short, ' + meta.config.minimumTitleLength + ']]'));
		} else if (data.title && data.title.length > parseInt(meta.config.maximumTitleLength, 10)) {
			return callback(new Error('[[error:title-too-long, ' + meta.config.maximumTitleLength + ']]'));
		} else if (data.tags && data.tags.length < parseInt(meta.config.minimumTagsPerTopic, 10)) {
			return callback(new Error('[[error:not-enough-tags, ' + meta.config.minimumTagsPerTopic + ']]'));
		} else if (data.tags && data.tags.length > parseInt(meta.config.maximumTagsPerTopic, 10)) {
			return callback(new Error('[[error:too-many-tags, ' + meta.config.maximumTagsPerTopic + ']]'));
		} else if (!data.content || data.content.length < parseInt(meta.config.minimumPostLength, 10)) {
			return callback(new Error('[[error:content-too-short, ' + meta.config.minimumPostLength + ']]'));
		} else if (data.content.length > parseInt(meta.config.maximumPostLength, 10)) {
			return callback(new Error('[[error:content-too-long, ' + meta.config.maximumPostLength + ']]'));
		}

		posts.edit({
			uid: socket.uid,
			handle: data.handle,
			pid: data.pid,
			title: data.title,
			content: data.content,
			topic_thumb: data.topic_thumb,
			tags: data.tags,
			req: websockets.reqFromSocket(socket)
		}, function(err, result) {
			if (err) {
				return callback(err);
			}

			if (result.topic.renamed) {
				events.log({
					type: 'topic-rename',
					uid: socket.uid,
					ip: socket.ip,
					oldTitle: validator.escape(String(result.topic.oldTitle)),
					newTitle: validator.escape(String(result.topic.title))
				});
			}

			if (parseInt(result.post.deleted) !== 1) {
				websockets.in('topic_' + result.topic.tid).emit('event:post_edited', result);
				return callback(null, result.post);
			}

			socket.emit('event:post_edited', result);
			callback(null, result.post);

			async.parallel({
				admins: async.apply(groups.getMembers, 'administrators', 0, -1),
				moderators: async.apply(groups.getMembers, 'cid:' + result.topic.cid + ':privileges:mods', 0, -1)
			}, function(err, results) {
				if (err) {
					return winston.error(err);
				}

				var uids = results.admins.concat(results.moderators).filter(function(uid, index, array) {
					return uid && array.indexOf(uid) === index;
				});

				uids.forEach(function(uid) {
					websockets.in('uid_' + uid).emit('event:post_edited', result);
				});
			});
		});
	};
};