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

		// only affects persona, harmony uses a different structure in harmony.js
		const tooltipEls = $('#header-menu .nav-item[title]');

		tooltipEls.tooltip({
			trigger: 'manual',
			animation: false,
			placement: 'bottom',
		});

		tooltipEls.on('mouseenter', function (ev) {
			const target = $(ev.target);
			const isDropdown = target.hasClass('dropdown-menu') || !!target.parents('.dropdown-menu').length;
			if (!isDropdown) {
				$(this).tooltip('show');
			}
		});
		tooltipEls.on('click mouseleave', function () {
			$(this).tooltip('hide');
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
