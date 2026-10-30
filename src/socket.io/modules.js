'use strict';

const Messaging = require('../messaging');
const user = require('../user');
const groups = require('../groups');


const SocketModules = module.exports;

SocketModules.chats = {};
SocketModules.settings = {};

/* Chat */

SocketModules.chats.enter = async function (socket, roomIds) {
	await joinLeave(socket, roomIds, 'join');
};

SocketModules.chats.leave = async function (socket, roomIds) {
	await joinLeave(socket, roomIds, 'leave');
};

SocketModules.chats.enterPublic = async function (socket, roomIds) {
	await joinLeave(socket, roomIds, 'join', 'chat_room_public');
};

SocketModules.chats.leavePublic = async function (socket, roomIds) {
	await joinLeave(socket, roomIds, 'leave', 'chat_room_public');
};

async function joinLeave(socket, roomIds, method, prefix = 'chat_room') {
	if (!(socket.uid > 0)) {
		throw new Error('[[error:not-allowed]]');
	}
	if (!Array.isArray(roomIds)) {
		roomIds = [roomIds];
	}
	if (roomIds.length) {
		const [isAdmin, inRooms, roomData] = await Promise.all([
			user.isAdministrator(socket.uid),
			Messaging.isUserInRoom(socket.uid, roomIds),
			Messaging.getRoomsData(roomIds, ['public', 'groups']),
		]);

		await Promise.all(roomIds.map(async (roomId, idx) => {
			const isPublic = roomData[idx] && roomData[idx].public;
			const roomGroups = roomData[idx] && roomData[idx].groups;

			if (isAdmin ||
				(
					inRooms[idx] &&
					(!isPublic || !roomGroups.length || await groups.isMemberOfAny(socket.uid, roomGroups))
				)
			) {
				socket[method](`${prefix}_${roomId}`);
			}
		}));
	}
}

require('../promisify')(SocketModules);
