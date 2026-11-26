'use strict';

const db = require('../database');
const sockets = require('../socket.io');
const plugins = require('../plugins');
const activitypub = require('../activitypub');

module.exports = function (Messaging) {
	Messaging.deleteMessage = async (mid, uid) => await doDeleteRestore(mid, 1, uid);
	Messaging.restoreMessage = async (mid, uid) => await doDeleteRestore(mid, 0, uid);
	Messaging.purgeMessage = async (mids) => {
		mids = Array.isArray(mids) ? mids : [mids];
		const msgData = await Messaging.getMessagesFields(mids, [
			'mid', 'fromuid', 'roomId', 'deleted', 'system', 'toMid',
		]);
		if (!msgData.length) {
			return;
		}

		const midsPerRoom = {};
		for (const m of msgData) {
			if (m && m.mid && m.roomId) {
				midsPerRoom[m.roomId] = (midsPerRoom[m.roomId] || new Set()).add(m.mid);
			}
		}

		const totalPurgeCount = new Set(msgData.filter(m => m && m.mid).map(m => m.mid)).size;

		await db.deleteAll([
			...msgData.map(m => `message:${m.mid}`),
			...msgData.map(m => `mid:${m.mid}:replies`),
		]);

		const promises = [
			db.sortedSetRemove(`messages:mid`, mids),
		];

		for (const [roomId, midsSet] of Object.entries(midsPerRoom)) {
			promises.push(
				db.sortedSetRemove(`chat:room:${roomId}:mids`, Array.from(midsSet))
			);
			promises.push(
				db.sortedSetRemove(`chat:room:${roomId}:mids:pinned`, Array.from(midsSet))
			);
			promises.push(
				db.incrObjectFieldBy(`chat:room:${roomId}`, 'messageCount', -midsSet.size)
			);
		}
		const bulkRemoveFromParent = msgData.filter(m => m && m.toMid)
			.map(m => [`mid:${m.toMid}:replies`, m.mid]);

		await Promise.all([
			...promises,
			db.incrObjectFieldBy('global', 'messageCount', -totalPurgeCount),
			db.sortedSetRemoveBulk(bulkRemoveFromParent),
		]);

		plugins.hooks.fire('action:messaging.purge', { messages: msgData });
	};

	async function doDeleteRestore(mid, state, uid) {
		const field = state ? 'deleted' : 'restored';
		const msgData = await Messaging.getMessageFields(mid, [
			'mid', 'fromuid', 'deleted', 'roomId', 'content', 'system',
		]);
		if (msgData.deleted === state) {
			throw new Error(`[[error:chat-${field}-already]]`);
		}

		await Messaging.setMessageField(mid, 'deleted', state);
		msgData.deleted = state;

		const ioRoom = sockets.in(`chat_room_${msgData.roomId}`);
		if (state === 1 && ioRoom) {
			ioRoom.emit('event:chats.delete', mid);
			plugins.hooks.fire('action:messaging.delete', { message: msgData });
		} else if (state === 0 && ioRoom) {
			const messages = await Messaging.getMessagesData([mid], uid, msgData.roomId, true);
			ioRoom.emit('event:chats.restore', messages[0]);
			plugins.hooks.fire('action:messaging.restore', { message: msgData });
		}

		setImmediate(() => {
			if (state === 1) {
				activitypub.out.delete.privateNote(uid, msgData);
			} else {
				activitypub.out.update.privateNote(uid, msgData);
			}
		});
	}
};
