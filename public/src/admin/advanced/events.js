"use strict";
/* global define, socket, app, templates */


define('admin/advanced/events', ['forum/infinitescroll'], function(infinitescroll) {
	var	Events = {};

	Events.init = function() {

		$('[data-action="clear"]').on('click', function() {
			socket.emit('admin.deleteAllEvents', function(err) {
				if (err) {
					return app.alertError(err.message);
				}
				$('.events-list').empty();
			});
		});

		infinitescroll.init(function(direction) {
			if (direction < 0 || !$('.events').length) {
				return;
			}

			infinitescroll.loadMore('admin.getMoreEvents', $('[data-next]').attr('data-next'), function(data, done) {
				if (data.events && data.events.length) {
					templates.parse('admin/advanced/events', 'events', {events: data.events}, function(html) {
						$('.events-list').append(html);
						done();
					});

					$('[data-next]').attr('data-next', data.next);
				} else {
					done();
				}
			});
		});

	};

	return Events;
});
