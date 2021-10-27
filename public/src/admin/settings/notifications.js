'use strict';

define('admin/settings/notifications', [
	'autocomplete',
], function (autocomplete) {
	const	Notifications = {};

	Notifications.init = function () {
		const searchInput = $('[data-field="welcomeUid"]');
		autocomplete.user(searchInput, function (event, selected) {
			setTimeout(function () {
				searchInput.val(selected.item.user.uid);
			});
		});
	};

	return Notifications;
});
