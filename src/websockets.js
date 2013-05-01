var	SocketIO = require('socket.io').listen(global.server),
	cookie = require('cookie'),
	connect = require('connect');

(function(io) {
	var	modules = null,
		sessionID,
		uid;

	global.io = io;
	module.exports.init = function() {
		modules = global.modules;
	}

	// Adapted from http://howtonode.org/socket-io-auth
	io.set('authorization', function(handshakeData, accept) {
		if (handshakeData.headers.cookie) {
			handshakeData.cookie = cookie.parse(handshakeData.headers.cookie);
			handshakeData.sessionID = connect.utils.parseSignedCookie(handshakeData.cookie['express.sid'], 'nodebb');

			if (handshakeData.cookie['express.sid'] == handshakeData.sessionID) {
				return accept('Cookie is invalid.', false);
			}
		} else {
			// No cookie sent
			return accept('No cookie transmitted', false);
		}

		// Otherwise, continue unimpeded.
		sessionID = handshakeData.sessionID;
		global.modules.user.get_uid_by_session(sessionID, function(session_uid) {
			if (session_uid) uid = session_uid;
			else uid = 0;

			accept(null, true);
		});
	});

	io.sockets.on('connection', function(socket) {
		global.socket = socket;

		if (DEVELOPMENT === true) {
			// refreshing templates
			modules.templates.init();
		}

		socket.emit('event:connect', {status: 1});
		
		// BEGIN: API calls (todo: organize)
		//   julian: :^)
		socket.on('api:user.get', function(data) {
			modules.user.get(uid, data.fields);
		});

		socket.on('user.create', function(data) {
			modules.user.create(data.username, data.password, data.email);
		});

		socket.on('user.exists', function(data) {
			modules.user.exists(data.username);
		});

		socket.on('user.count', function(data) {
			modules.user.count(data);
		});

		socket.on('user.latest', function(data) {
			modules.user.latest(data);
		});

		socket.on('user.login', function(data) {
			data.sessionID = sessionID;
			modules.user.login(data);
		});

		socket.on('user.email.exists', function(data) {
			modules.user.email.exists(data.email);
		});

		socket.on('user:reset.send', function(data) {
			modules.user.reset.send(data.email);
		});

		socket.on('user:reset.valid', function(data) {
			modules.user.reset.validate(data.code);
		});

		socket.on('user:reset.commit', function(data) {
			modules.user.reset.commit(data.code, data.password);
		});

		socket.on('api:topics.post', function(data) {
			modules.topics.post(uid, data.title, data.content);
		});

		socket.on('api:posts.reply', function(data) {
			modules.posts.reply(data.topic_id, uid, data.content);
		});

		socket.on('api:user.active.get', function() {
			modules.user.active.get();
		});

		socket.on('api:user.active.get_record', function() {
			modules.user.active.get_record();
		});
	});
	
}(SocketIO));
