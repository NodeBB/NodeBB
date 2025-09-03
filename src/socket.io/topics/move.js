'use strict';

const async = require('async');
const topics = require('../../topics');
const categories = require('../../categories');
const privileges = require('../../privileges');
const events = require('../../events');

const api = require('../../api');
const sockets = require('..');

module.exports = function (SocketTopics) {
	SocketTopics.move = async function (socket, data) {
		sockets.warnDeprecated(socket, 'PUT /api/v3/topics/:tid/move');

		if (!data || !Array.isArray(data.tids) || !data.cid) {
			throw new Error('[[error:invalid-data]]');
		}

		await api.topics.move(socket, {
			tid: data.tids,
			cid: data.cid,
		});
	};


	SocketTopics.moveAll = async function (socket, data) {
		if (!data || !data.cid || !data.currentCid) {
			throw new Error('[[error:invalid-data]]');
		}
		const canMove = await privileges.categories.canMoveAllTopics(data.currentCid, data.cid, socket.uid);
		if (!canMove) {
			throw new Error('[[error:no-privileges]]');
		}

		const tids = await categories.getAllTopicIds(data.currentCid, 0, -1);
		data.uid = socket.uid;
		await async.eachLimit(tids, 50, async (tid) => {
			await topics.tools.move(tid, data);
		});
		await categories.onTopicsMoved([data.currentCid, data.cid]);
		await events.log({
			type: `topic-move-all`,
			uid: socket.uid,
			ip: socket.ip,
			fromCid: data.currentCid,
			toCid: data.cid,
		});
	};
};
