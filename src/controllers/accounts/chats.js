'use strict';

const db = require('../../database');
const messaging = require('../../messaging');
const meta = require('../../meta');
const user = require('../../user');
const privileges = require('../../privileges');
const helpers = require('../helpers');

const chatsController = module.exports;

chatsController.get = async function (req, res, next) {
	if (meta.config.disableChat) {
		return next();
	}

	const uid = await user.getUidByUserslug(req.params.userslug);
	if (!uid) {
		return next();
	}
	const canChat = await privileges.global.can('chat', req.uid);
	if (!canChat) {
		return helpers.notAllowed(req, res);
	}

	const payload = {
		title: '[[pages:chats]]',
		uid: uid,
		userslug: req.params.userslug,
	};
	const isSwitch = res.locals.isAPI && parseInt(req.query.switch, 10) === 1;
	if (!isSwitch) {
		const [recentChats, publicRooms, privateRoomCount] = await Promise.all([
			messaging.getRecentChats(req.uid, uid, 0, 29),
			messaging.getPublicRooms(req.uid, uid),
			db.sortedSetCard(`uid:${uid}:chat:rooms`),
		]);
		if (!recentChats) {
			return next();
		}
		payload.rooms = recentChats.rooms;
		payload.nextStart = recentChats.nextStart;
		payload.publicRooms = publicRooms;
		payload.privateRoomCount = privateRoomCount;
	}

	if (!req.params.roomid) {
		return res.render('chats', payload);
	}

	const room = await messaging.loadRoom(req.uid, { uid: uid, roomId: req.params.roomid });
	if (!room) {
		return next();
	}

	room.title = room.roomName || room.usernames || '[[pages:chats]]';
	room.bodyClasses = ['chat-loaded'];
	room.canViewInfo = await privileges.global.can('view:users:info', uid);

	res.render('chats', {
		...payload,
		...room,
	});
};

chatsController.redirectToChat = async function (req, res, next) {
	if (!req.loggedIn) {
		return next();
	}
	const userslug = await user.getUserField(req.uid, 'userslug');
	if (!userslug) {
		return next();
	}
	const roomid = parseInt(req.params.roomid, 10);
	helpers.redirect(res, `/user/${userslug}/chats${roomid ? `/${roomid}` : ''}`);
};
