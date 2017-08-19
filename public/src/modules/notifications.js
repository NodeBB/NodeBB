'use strict';


define('notifications', ['sounds', 'translator', 'components', 'navigator'], function (sounds, translator, components, navigator) {
	var Notifications = {};

	var unreadNotifs = {};

	Notifications.prepareDOM = function () {
		var notifContainer = components.get('notifications');
		var notifTrigger = notifContainer.children('a');
		var notifList = components.get('notifications/list');

		notifTrigger.on('click', function (e) {
			e.preventDefault();
			if (notifContainer.hasClass('open')) {
				return;
			}

			Notifications.loadNotifications(notifList);
		});

		notifList.on('click', '[data-nid]', function (ev) {
			var notifEl = $(this);
			if (scrollToPostIndexIfOnPage(notifEl)) {
				ev.stopPropagation();
				ev.preventDefault();
				notifTrigger.dropdown('toggle');
			}

			var unread = notifEl.hasClass('unread');
			if (!unread) {
				return;
			}
			var nid = notifEl.attr('data-nid');
			socket.emit('notifications.markRead', nid, function (err) {
				if (err) {
					return app.alertError(err.message);
				}

				if (unreadNotifs[nid]) {
					delete unreadNotifs[nid];
				}
			});
		});

		notifContainer.on('click', '.mark-all-read', Notifications.markAllRead);

		notifList.on('click', '.mark-read', function () {
			var liEl = $(this).parent();
			var unread = liEl.hasClass('unread');
			var nid = liEl.attr('data-nid');

			socket.emit('notifications.mark' + (unread ? 'Read' : 'Unread'), nid, function (err) {
				if (err) {
					return app.alertError(err.message);
				}

				liEl.toggleClass('unread');

				if (unread && unreadNotifs[nid]) {
					delete unreadNotifs[nid];
				}
			});
			return false;
		});

		socket.on('event:new_notification', function (notifData) {
			// If a path is defined, show notif data, otherwise show generic data
			var payload = {
				alert_id: 'new_notif',
				title: '[[notifications:new_notification]]',
				timeout: 2000,
			};

			if (notifData.path) {
				payload.message = notifData.bodyShort;
				payload.type = 'info';
				payload.clickfn = function () {
					if (notifData.path.startsWith('http') && notifData.path.startsWith('https')) {
						window.location.href = notifData.path;
					} else {
						window.location.href = window.location.protocol + '//' + window.location.host + config.relative_path + notifData.path;
					}
				};
			} else {
				payload.message = '[[notifications:you_have_unread_notifications]]';
				payload.type = 'warning';
			}

			app.alert(payload);
			app.refreshTitle();

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
				sounds.play('notification', notifData.nid);
				unreadNotifs[notifData.nid] = true;
			}
		});

		socket.on('event:notifications.updateCount', function (count) {
			Notifications.updateNotifCount(count);
		});
	};

	function scrollToPostIndexIfOnPage(notifEl) {
		// Scroll to index if already in topic (gh#5873)
		var pid = notifEl.attr('data-pid');
		var tid = notifEl.attr('data-tid');
		var path = notifEl.attr('data-path');
		var postEl = components.get('post', 'pid', pid);
		if (path.startsWith(config.relative_path + '/post/') && pid && postEl.length && ajaxify.data.template.topic && parseInt(ajaxify.data.tid, 10) === parseInt(tid, 10)) {
			navigator.scrollToIndex(postEl.attr('data-index'), true);
			return true;
		}
		return false;
	}

	Notifications.loadNotifications = function (notifList) {
		socket.emit('notifications.get', null, function (err, data) {
			if (err) {
				return app.alertError(err.message);
			}

			var notifs = data.unread.concat(data.read).sort(function (a, b) {
				return parseInt(a.datetime, 10) > parseInt(b.datetime, 10) ? -1 : 1;
			});

			translator.toggleTimeagoShorthand();
			for (var i = 0; i < notifs.length; i += 1) {
				notifs[i].timeago = $.timeago(new Date(parseInt(notifs[i].datetime, 10)));
			}
			translator.toggleTimeagoShorthand();

			templates.parse('partials/notifications_list', { notifications: notifs }, function (html) {
				notifList.translateHtml(html);
			});
		});
	};

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
