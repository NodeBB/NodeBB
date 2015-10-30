'use strict';

/* globals define, socket, app */

define('forum/notifications', ['components', 'notifications', 'forum/infinitescroll'], function(components, notifs, infinitescroll) {
	var Notifications = {};

	Notifications.init = function() {
		var listEl = $('.notifications-list');
		listEl.on('click', '[component="notifications/item/link"]', function() {
			var nid = $(this).parents('[data-nid]').attr('data-nid');
			socket.emit('notifications.markRead', nid, function(err) {
				if (err) {
					return app.alertError(err);
				}
			});
		});

		$('.timeago').timeago();

		components.get('notifications/mark_all').on('click', function() {
			socket.emit('notifications.markAllRead', function(err) {
				if (err) {
					return app.alertError(err.message);
				}

				components.get('notifications/item').removeClass('unread');
				notifs.updateNotifCount(0);
			});
		});

		infinitescroll.init(loadMoreNotifications);
	};

	function loadMoreNotifications(direction) {
		if (direction < 0) {
			return;
		}
		var notifList = $('.notifications-list');
		infinitescroll.loadMore('notifications.loadMore', {
			after: notifList.attr('data-nextstart')
		}, function(data, done) {
			if (!data) {
				return done();
			}
			notifList.attr('data-nextstart', data.nextStart);
			if (!data.notifications || !data.notifications.length) {
				return done();
			}
			app.parseAndTranslate('notifications', 'notifications', {notifications: data.notifications}, function(html) {
				notifList.append(html);
				html.find('.timeago').timeago();
				done();
			});
		});
	}

	return Notifications;
});
