var socket,
	config;

(function() {

	$.get('config.json?v=' + new Date().getTime(), function(data) {
		config = data;
		socket = io.connect('http://' + config.socket.address + config.socket.port? ':' + config.socket.port : '');

		socket.on('event:connect', function(data) {
			
		});

	});

	
}());
