'use strict';


define('forum/account/sessions', ['forum/account/header', 'components'], function (header, components) {
	var Sessions = {};

	Sessions.init = function () {
		header.init();
		Sessions.prepareSessionRevocation();
	};

	Sessions.prepareSessionRevocation = function () {
		components.get('user/sessions').on('click', '[data-action]', function () {
			var parentEl = $(this).parents('[data-uuid]');
			var uuid = parentEl.attr('data-uuid');

			if (uuid) {
				// This is done via DELETE because a user shouldn't be able to
				// revoke his own session! This is what logout is for
				$.ajax({
					url: config.relative_path + '/api/user/' + ajaxify.data.userslug + '/session/' + uuid,
					method: 'delete',
					headers: {
						'x-csrf-token': config.csrf_token,
					},
				}).done(function () {
					parentEl.remove();
				}).fail(function (err) {
					try {
						var errorObj = JSON.parse(err.responseText);
						if (errorObj.loggedIn === false) {
							window.location.href = config.relative_path + '/login?error=' + errorObj.title;
						}
						app.alertError(errorObj.title);
					} catch (e) {
						app.alertError('[[error:invalid-data]]');
					}
				});
			}
		});
	};

	return Sessions;
});
