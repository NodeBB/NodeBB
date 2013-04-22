var socket,
	config;

(function() {

	$.ajax({
		url: 'config.json?v=' + new Date().getTime(),
		success: function(data) {
			config = data;
			socket = io.connect('http://' + config.socket.address + config.socket.port? ':' + config.socket.port : '');

			socket.on('event:connect', function(data) {
				
			});
		},
		async: false


	});

	
}());
