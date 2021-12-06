'use strict';

define('forum/header', ['forum/header/notifications', 'forum/header/chat', 'alerts'], function (notifications, chat, alerts) {
	const module = {};

	module.prepareDOM = function () {
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
					$(this).find('span').toggleClass('bold', $(this).attr('data-status') === status);
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
		$('#header-menu li a[title]').each(function () {
			$(this).tooltip({
				placement: 'bottom',
				trigger: 'hover',
				title: $(this).attr('title'),
			});
		});


		$('#search-form').tooltip({
			placement: 'bottom',
			trigger: 'hover',
			title: $('#search-button i').attr('title'),
		});


		$('#user_dropdown').tooltip({
			placement: 'bottom',
			trigger: 'hover',
			title: $('#user_dropdown').attr('title'),
		});
	}

	function handleLogout() {
		$('#header-menu .container').on('click', '[component="user/logout"]', function () {
			require(['logout'], function (logout) {
				logout();
			});
			return false;
		});
	}

	return module;
});
