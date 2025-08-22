'use strict';


define('notifications', [
	'translator',
	'components',
	'navigator',
	'tinycon',
	'hooks',
	'alerts',
], function (translator, components, navigator, Tinycon, hooks, alerts) {
	const Notifications = {};

	let unreadNotifs = {};

	const _addTimeagoString = ({ notifications: notifs }) => new Promise((resolve) => {
		for (let i = 0; i < notifs.length; i += 1) {
			notifs[i].timeagoLong = $.timeago(new Date(parseInt(notifs[i].datetime, 10)));
		}
		translator.toggleTimeagoShorthand(function () {
			for (let i = 0; i < notifs.length; i += 1) {
				notifs[i].timeago = $.timeago(new Date(parseInt(notifs[i].datetime, 10)));
				notifs[i].timeagoShort = notifs[i].timeago;
			}
			translator.toggleTimeagoShorthand();
			resolve({ notifications: notifs });
		});
	});
	hooks.on('filter:notifications.load', _addTimeagoString);

	Notifications.loadNotifications = function (triggerEl, notifList, callback) {
		callback = callback || function () {};
		socket.emit('notifications.get', null, function (err, data) {
			if (err) {
				return alerts.error(err);
			}

			const notifs = data.unread.concat(data.read).sort(function (a, b) {
				return parseInt(a.datetime, 10) > parseInt(b.datetime, 10) ? -1 : 1;
			});

			hooks.fire('filter:notifications.load', { notifications: notifs }).then(({ notifications }) => {
				app.parseAndTranslate('partials/notifications_list', { notifications }, function (html) {
					notifList.html(html);
					notifList.off('click').on('click', '[data-nid]', function (ev) {
						const notifEl = $(this);
						if (scrollToPostIndexIfOnPage(notifEl)) {
							ev.stopPropagation();
							ev.preventDefault();
							if (triggerEl) {
								triggerEl.dropdown('toggle');
							}
						}

						const unread = notifEl.hasClass('unread');
						if (!unread) {
							return;
						}
						const nid = notifEl.attr('data-nid');
						markNotification(nid, true);
					});
					components.get('notifications').on('click', '.mark-all-read', () => {
						Notifications.markAllRead();
					});

					Notifications.handleUnreadButton(notifList);

					hooks.fire('action:notifications.loaded', {
						notifications: notifs,
						list: notifList,
					});
					callback();
				});
			});
		});
	};

	Notifications.handleUnreadButton = function (notifList) {
		notifList.on('click', '.mark-read', function () {
			const $this = $(this);
			const notifEl = $this.parents('[data-nid]');
			const unread = notifEl.hasClass('unread');
			const nid = notifEl.attr('data-nid');
			markNotification(nid, unread, function () {
				notifEl.toggleClass('unread');
				$this.find('.unread').toggleClass('hidden', unread);
				$this.find('.read').toggleClass('hidden', !unread);
			});
			return false;
		});
	};

	Notifications.onNewNotification = function (notifData) {
		if (ajaxify.currentPage === 'notifications') {
			ajaxify.refresh();
		}
		if (ajaxify.data.template.chats && parseInt(ajaxify.data.roomId, 10) === parseInt(notifData.roomId, 10)) {
			return;
		}

		socket.emit('notifications.getCount', function (err, count) {
			if (err) {
				return alerts.error(err);
			}

			Notifications.updateNotifCount(count);
		});

		if (!unreadNotifs[notifData.nid]) {
			unreadNotifs[notifData.nid] = notifData;
		}
	};

	Notifications.markNotification = function (nid, read, callback) {
		markNotification(nid, read, callback);
	};

	function markNotification(nid, read, callback) {
		socket.emit('notifications.mark' + (read ? 'Read' : 'Unread'), nid, function (err) {
			if (err) {
				return alerts.error(err);
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
		const pid = notifEl.attr('data-pid');
		const path = notifEl.attr('data-path');
		const postEl = components.get('post', 'pid', pid);
		if (path.startsWith(config.relative_path + '/post/') && pid && postEl.length && ajaxify.data.template.topic) {
			navigator.scrollToIndex(postEl.attr('data-index'), true);
			return true;
		}
		return false;
	}

	Notifications.updateNotifCount = function (count) {
		const notifIcon = components.get('notifications/icon');
		count = Math.max(0, count);
		notifIcon.toggleClass('fa-bell', count > 0)
			.toggleClass('fa-bell-o', count <= 0);

		const countText = count > 99 ? '99+' : count;
		notifIcon.toggleClass('unread-count', count > 0);
		notifIcon.attr('data-content', countText);
		components.get('notifications/count').toggleClass('hidden', count <= 0).text(countText);
		const payload = {
			count: count,
			updateFavicon: true,
		};
		hooks.fire('action:notification.updateCount', payload);

		if (payload.updateFavicon) {
			Tinycon.setBubble(countText);
		}

		if (navigator.setAppBadge) { // feature detection
			navigator.setAppBadge(count);
		}
	};

	Notifications.markAllRead = function (filter = '') {
		socket.emit('notifications.markAllRead', { filter }, function (err) {
			if (err) {
				alerts.error(err);
			}
			if (filter) {
				Object.keys(unreadNotifs).forEach(nid => {
					if (unreadNotifs[nid].type === filter) {
						delete unreadNotifs[nid];
					}
				});
			} else {
				unreadNotifs = {};
			}

			const notifEls = $('[component="notifications/list"] [data-nid]');
			notifEls.removeClass('unread');
			notifEls.find('.mark-read .unread').addClass('hidden');
			notifEls.find('.mark-read .read').removeClass('hidden');
		});
	};

	return Notifications;
});
