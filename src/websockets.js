var	SocketIO = require('socket.io').listen(global.server),
	cookie = require('cookie'),
	connect = require('connect');

(function(io) {
	var	modules = null,
		sessionID;

	global.io = io;
	module.exports.init = function() {
		modules = global.modules;
	}

	// Adapted from http://howtonode.org/socket-io-auth
	io.set('authorization', function(handshakeData, accept) {
		if (handshakeData.headers.cookie) {
			handshakeData.cookie = cookie.parse(handshakeData.headers.cookie);
			handshakeData.sessionID = connect.utils.parseSignedCookie(handshakeData.cookie['express.sid'], 'nodebb-julian');

			if (handshakeData.cookie['express.sid'] == handshakeData.sessionID) {
				return accept('Cookie is invalid.', false);
			}
		} else {
			// No cookie sent
			return accept('No cookie transmitted', false);
		}

		// Otherwise, continue unimpeded.
		sessionID = handshakeData.sessionID;
		accept(null, true);
	});

	io.sockets.on('connection', function(socket) {
		global.socket = socket;

		if (DEVELOPMENT === true) {
			// refreshing templates
			modules.templates.init();
		}

		// not required, "connect" emitted automatically
		// socket.emit('event:connect', {status: 1});
		
		// BEGIN: API calls (todo: organize)
		//   julian: :^)
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
	});
	
}(SocketIO));
