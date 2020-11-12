'use strict';


define('notifications', [
	'translator',
	'components',
	'navigator',
	'benchpress',
	'tinycon',
], function (translator, components, navigator, Benchpress, Tinycon) {
	var Notifications = {};

	var unreadNotifs = {};

	Notifications.loadNotifications = function (notifList) {
		socket.emit('notifications.get', null, function (err, data) {
			if (err) {
				return app.alertError(err.message);
			}

			var notifs = data.unread.concat(data.read).sort(function (a, b) {
				return parseInt(a.datetime, 10) > parseInt(b.datetime, 10) ? -1 : 1;
			});

			translator.toggleTimeagoShorthand(function () {
				for (var i = 0; i < notifs.length; i += 1) {
					notifs[i].timeago = $.timeago(new Date(parseInt(notifs[i].datetime, 10)));
				}
				translator.toggleTimeagoShorthand();
				app.parseAndTranslate('partials/notifications_list', { notifications: notifs }, function (html) {
					notifList.html(html);
					notifList.off('click').on('click', '[data-nid]', function (ev) {
						var notifEl = $(this);
						if (scrollToPostIndexIfOnPage(notifEl)) {
							ev.stopPropagation();
							ev.preventDefault();
							components.get('notifications/list').dropdown('toggle');
						}

						var unread = notifEl.hasClass('unread');
						if (!unread) {
							return;
						}
						var nid = notifEl.attr('data-nid');
						markNotification(nid, true);
					});
					components.get('notifications').on('click', '.mark-all-read', Notifications.markAllRead);

					notifList.on('click', '.mark-read', function () {
						var liEl = $(this).parent();
						var unread = liEl.hasClass('unread');
						var nid = liEl.attr('data-nid');
						markNotification(nid, unread, function () {
							liEl.toggleClass('unread');
						});
						return false;
					});
				});
			});
		});
	};

	Notifications.onNewNotification = function (notifData) {
		if (ajaxify.currentPage === 'notifications') {
			ajaxify.refresh();
		}

		socket.emit('notifications.getCount', function (err, count) {
			if (err) {
				return app.alertError(err.message);
			}

			Notifications.updateNotifCount(count);
		});

		if (!unreadNotifs[notifData.nid]) {
			unreadNotifs[notifData.nid] = true;
		}
	};

	function markNotification(nid, read, callback) {
		socket.emit('notifications.mark' + (read ? 'Read' : 'Unread'), nid, function (err) {
			if (err) {
				return app.alertError(err.message);
			}

			if (read && unreadNotifs[nid]) {
				delete unreadNotifs[nid];
			}
			if (callback) {
				callback();
			}
		});
	}

	function scrollToPostIndexIfOnPage(notifEl) {
		// Scroll to index if already in topic (gh#5873)
		var pid = notifEl.attr('data-pid');
		var path = notifEl.attr('data-path');
		var postEl = components.get('post', 'pid', pid);
		if (path.startsWith(config.relative_path + '/post/') && pid && postEl.length && ajaxify.data.template.topic) {
			navigator.scrollToIndex(postEl.attr('data-index'), true);
			return true;
		}
		return false;
	}

	Notifications.updateNotifCount = function (count) {
		var notifIcon = components.get('notifications/icon');
		count = Math.max(0, count);
		if (count > 0) {
			notifIcon.removeClass('fa-bell-o').addClass('fa-bell');
		} else {
			notifIcon.removeClass('fa-bell').addClass('fa-bell-o');
		}

		notifIcon.toggleClass('unread-count', count > 0);
		notifIcon.attr('data-content', count > 99 ? '99+' : count);

		var payload = {
			count: count,
			updateFavicon: true,
		};
		$(window).trigger('action:notification.updateCount', payload);

		if (payload.updateFavicon) {
			Tinycon.setBubble(count > 99 ? '99+' : count);
		}
	};

	Notifications.markAllRead = function () {
		socket.emit('notifications.markAllRead', function (err) {
			if (err) {
				app.alertError(err.message);
			}
			unreadNotifs = {};
		});
	};

	return Notifications;
});
