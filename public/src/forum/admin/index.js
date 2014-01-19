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

	Admin.updateRoomUsage = function(err, data) {
		var active_users = $('#active_users'),
			total = 0;

		if(!active_users.length) {
			return;
		}

		active_users.html('');

		var usersHtml = '';

		for (var room in data) {
			if (room !== '') {
				var count = $(data[room]).length;
				total += count;
				usersHtml += "<div class='alert alert-success'><strong>" + room + "</strong> " + count + " active user" + (count > 1 ? "s" : "") + "</div>";
			}
		}

		active_users.html(usersHtml);
		document.getElementById('connections').innerHTML = total;
	};

	return Admin;
});
