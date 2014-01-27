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

		function getUserCountIn(room) {
			var count = 0;
			for(var user in data[room]) {
				++count;
			}
			return count;
		}

		var active_users = $('#active_users').html(''),
			total = 0;

		if(!active_users.length) {
			return;
		}


		var sortedData = [];

		for (var room in data) {
			if (room !== '') {
				sortedData.push({room: room, count: data[room].length});
				total += data[room].length;
			}
		}

		sortedData.sort(function(a, b) {
			return parseInt(b.count, 10) - parseInt(a.count, 10);
		});

		var usersHtml = '';
		for(var i=0; i<sortedData.length; ++i) {
			usersHtml += "<div class='alert alert-success'><strong>" + sortedData[i].room + "</strong> " +
				sortedData[i].count + " active user" + (sortedData[i].count > 1 ? "s" : "") + "</div>";
		}

		active_users.html(usersHtml);
		$('#connections').html(total);
	};

	return Admin;
});
