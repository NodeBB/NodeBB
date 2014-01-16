define(function() {
	var	Admin = {};

	Admin.init = function() {
		ajaxify.register_events(['meta.rooms.getAll']);

		app.enterRoom('admin');
		socket.emit('meta.rooms.getAll', Admin.updateRoomUsage);
		socket.on('event:meta.rooms.update', Admin.updateRoomUsage);

		$('#logout-link').on('click', function() {
			$.post(RELATIVE_PATH + '/logout', {
				_csrf: $('#csrf_token').val()
			}, function() {
				window.location.href = RELATIVE_PATH + '/';
			});
		})
	};

	Admin.updateRoomUsage = function(data) {
		console.log('room usage updating', data);
		var active_users = document.getElementById('active_users'),
			total = 0;
			active_users.innerHTML = '';

		for (var room in data) {
			if (room !== '') {
				var count = data[room].length;
				total += count;
				active_users.innerHTML = active_users.innerHTML + "<div class='alert alert-success'><strong>" + room + "</strong> " + count + " active user" + (count > 1 ? "s" : "") + "</div>";
			}
		}

		document.getElementById('connections').innerHTML = total;
	};

	return Admin;
});
