'use strict';


const posts = require('../../posts');
const plugins = require('../../plugins');
const websockets = require('../index');
const socketHelpers = require('../helpers');

const helpers = module.exports;

helpers.postCommand = async function (socket, command, eventName, notification, data) {
	if (!socket.uid) {
		throw new Error('[[error:not-logged-in]]');
	}

	if (!data || !data.pid) {
		throw new Error('[[error:invalid-data]]');
	}

	if (!data.room_id) {
		throw new Error('[[error:invalid-room-id, ' + data.room_id + ' ]]');
	}
	const [exists, deleted] = await Promise.all([
		posts.exists(data.pid),
		posts.getPostField(data.pid, 'deleted'),
	]);

	if (!exists) {
		throw new Error('[[error:invalid-pid]]');
	}

	if (deleted) {
		throw new Error('[[error:post-deleted]]');
	}

	/*
	hooks:
		filter:post.upvote
		filter:post.downvote
		filter:post.unvote
		filter:post.bookmark
		filter:post.unbookmark
	 */
	const filteredData = await plugins.fireHook('filter:post.' + command, { data: data, uid: socket.uid });
	return await executeCommand(socket, command, eventName, notification, filteredData.data);
};

async function executeCommand(socket, command, eventName, notification, data) {
	const result = await posts[command](data.pid, socket.uid);
	if (result && eventName) {
		websockets.in('uid_' + socket.uid).emit('posts.' + command, result);
		websockets.in(data.room_id).emit('event:' + eventName, result);
	}
	if (result && command === 'upvote') {
		socketHelpers.upvote(result, notification);
	} else if (result && notification) {
		socketHelpers.sendNotificationToPostOwner(data.pid, socket.uid, command, notification);
	} else if (result && command === 'unvote') {
		socketHelpers.rescindUpvoteNotification(data.pid, socket.uid);
	}
	return result;
}
