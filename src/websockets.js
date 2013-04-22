
var SocketIO = require('socket.io').listen(8081);


(function(io) {
	var modules = null;


	module.exports.init = function() {
		modules = global.modules;
	}


	io.sockets.on('connection', function(socket) {
		global.socket = socket;

		if (DEVELOPMENT === true) {
			// refreshing templates
			modules.templates.init();
		}

		socket.emit('event:connect', {status: 1});
		
		// BEGIN: API calls (todo: organize)
		socket.on('user.create', function(data) {
			modules.user.create(data.username, data.password);
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
	});
	
}(SocketIO));
