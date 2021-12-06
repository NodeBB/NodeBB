'use strict';


define('forum/account/sessions', ['forum/account/header', 'components', 'api', 'alerts'], function (header, components, api, alerts) {
	const Sessions = {};

	Sessions.init = function () {
		header.init();
		Sessions.prepareSessionRevocation();
	};

	Sessions.prepareSessionRevocation = function () {
		components.get('user/sessions').on('click', '[data-action]', function () {
			const parentEl = $(this).parents('[data-uuid]');
			const uuid = parentEl.attr('data-uuid');

			if (uuid) {
				// This is done via DELETE because a user shouldn't be able to
				// revoke his own session! This is what logout is for
				api.del(`/users/${ajaxify.data.uid}/sessions/${uuid}`, {}).then(() => {
					parentEl.remove();
				}).catch((err) => {
					try {
						const errorObj = JSON.parse(err.responseText);
						if (errorObj.loggedIn === false) {
							window.location.href = config.relative_path + '/login?error=' + errorObj.title;
						}
						alerts.error(errorObj.title);
					} catch (e) {
						alerts.error('[[error:invalid-data]]');
					}
				});
			}
		});
	};

	return Sessions;
});
