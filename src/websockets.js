var	SocketIO = require('socket.io').listen(global.server,{log:false}),
	cookie = require('cookie'),
	connect = require('connect'),
	config = require('../config.js');

(function(io) {
	var	modules = null,
			users = {},
			rooms = {};

	global.io = io;
	module.exports.init = function() {
		modules = global.modules;
	}

	// Adapted from http://howtonode.org/socket-io-auth
	io.set('authorization', function(handshakeData, accept) {
		if (handshakeData.headers.cookie) {
			handshakeData.cookie = cookie.parse(handshakeData.headers.cookie);
			handshakeData.sessionID = connect.utils.parseSignedCookie(handshakeData.cookie['express.sid'], config.secret);

			if (handshakeData.cookie['express.sid'] == handshakeData.sessionID) {
				return accept('Cookie is invalid.', false);
			}
		} else {
			// No cookie sent
			return accept('No cookie transmitted', false);
		}

		// Otherwise, continue unimpeded.
		var sessionID = handshakeData.sessionID;
		
		global.modules.user.get_uid_by_session(sessionID, function(userId) {
			if (userId)
			{
				users[sessionID] = userId;
			}			
			else 
				users[sessionID] = 0;

			accept(null, true);
		});
	});

	io.sockets.on('connection', function(socket) {
		
		var hs = socket.handshake;
		
		var uid = users[hs.sessionID];

		if (DEVELOPMENT === true) {
			// refreshing templates
			modules.templates.init();
		}
		
		process.on('uncaughtException', function(err) {
    		// handle the error safely
    		console.log("error message "+err);
    		socket.emit('event:consolelog',{type:'uncaughtException', stack:err.stack, error:err.toString()});
		});

		socket.emit('event:connect', {status: 1});
		
		socket.on('disconnect', function() {
      		console.log('Got disconnect! SESSION ID : '+hs.sessionID+' USER ID : '+uid);

      		delete users[hs.sessionID];
      		console.log(users);
   		});

		

		socket.on('event:enter_room', function(data) {
			if (data.leave !== null) socket.leave (data.leave);
			socket.join(data.enter);

			rooms[data.enter] = rooms[data.enter] || {};
			if (uid) {
				rooms[data.enter][uid] = true;
				if (rooms[data.leave]) {
					delete rooms[data.leave][uid];
				}
			} else {
				rooms[data.enter].anonymous = rooms[data.enter].anonymous ? rooms[data.enter].anonymous + 1 : 1;
				rooms[data.leave].anonymous = rooms[data.leave].anonymous ? rooms[data.enter].anonymous - 1 : 0;
			}

			socket.emit('api:get_users_in_room', {
				uids: Object.keys(rooms[data.enter] || {}),
				anonymous: rooms[data.enter] ? rooms[data.enter].anonymous : 0
			});
		});

		// BEGIN: API calls (todo: organize)
		//   julian: :^)

		socket.on('api:user.get', function(data) {
			modules.user.get(socket, uid, data.fields);
		});
		
		socket.on('api:user.getNameByUid', function(data) {
			modules.user.get_username_by_uid(data.uid, function(data){
				socket.emit('api:user.getNameByUid', data);
			});
		});

		socket.on('user.exists', function(data) {
			modules.user.exists(socket, data.username);
		});

		socket.on('user.count', function(data) {
			modules.user.count(socket, data);
		});

		socket.on('user.latest', function(data) {
			modules.user.latest(socket, data);
		});

		socket.on('user.login', function(data) {
			data.sessionID = sessionID;
			modules.user.login(socket, data);
		});

		socket.on('user.email.exists', function(data) {
			modules.user.email.exists(socket, data.email);
		});

		socket.on('user:reset.send', function(data) {
			modules.user.reset.send(socket, data.email);
		});

		socket.on('user:reset.valid', function(data) {
			modules.user.reset.validate(socket, data.code);
		});

		socket.on('user:reset.commit', function(data) {
			modules.user.reset.commit(socket, data.code, data.password);
		});

		socket.on('api:topics.post', function(data) {
			modules.topics.post(socket, uid, data.title, data.content);
		});

		socket.on('api:posts.reply', function(data) {
			modules.posts.reply(socket, data.topic_id, uid, data.content);
		});

		socket.on('api:user.active.get', function() {
			modules.user.active.get();
		});

		socket.on('api:posts.favourite', function(data) {
			modules.posts.favourite(io, data.pid, data.room_id, uid);
		});

		socket.on('api:posts.unfavourite', function(data) {
			modules.posts.unfavourite(io, data.pid, data.room_id, uid);
		});

		socket.on('api:user.active.get_record', function() {
			modules.user.active.get_record(socket);
		});
	});
	
}(SocketIO));
