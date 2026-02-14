'use strict';

define('forum/header', [
	'forum/header/unread',
	'forum/header/notifications',
	'forum/header/chat',
	'alerts',
], function (unread, notifications, chat, alerts) {
	const module = {};

	module.prepareDOM = function () {
		if (app.user.uid > 0) {
			unread.initUnreadTopics();
		}
		notifications.prepareDOM();
		chat.prepareDOM();
		handleStatusChange();
		createHeaderTooltips();
		handleLogout();
	};

	function handleStatusChange() {
		$('[component="header/usercontrol"] [data-status]').off('click').on('click', function (e) {
			const status = $(this).attr('data-status');
			socket.emit('user.setStatus', status, function (err) {
				if (err) {
					return alerts.error(err);
				}
				$('[data-uid="' + app.user.uid + '"] [component="user/status"], [component="header/profilelink"] [component="user/status"]')
					.removeClass('away online dnd offline')
					.addClass(status);
				$('[component="header/usercontrol"] [data-status]').each(function () {
					$(this).toggleClass('selected', $(this).attr('data-status') === status);
				});
				app.user.status = status;
			});
			e.preventDefault();
		});
	}

	function createHeaderTooltips() {
		const env = utils.findBootstrapEnvironment();
		if (env === 'xs' || env === 'sm' || utils.isTouchDevice()) {
			return;
		}

		$('#header-menu #main-nav').tooltip({
			selector: '.nav-item',
			placement: 'bottom',
			trigger: 'hover',
			container: 'body',
			animation: false,
		});
	}

	function handleLogout() {
		$('body').on('click', '[component="user/logout"]', function () {
			require(['logout'], function (logout) {
				logout();
			});
			return false;
		});
	}

	return module;
});
