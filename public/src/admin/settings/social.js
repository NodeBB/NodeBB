'use strict';


define('admin/settings/social', ['alerts'], function (alerts) {
	const social = {};

	social.init = function () {
		$('#save').on('click', function () {
			const networks = [];
			$('#postSharingNetworks input[type="checkbox"]').each(function () {
				if ($(this).prop('checked')) {
					networks.push($(this).attr('id'));
				}
			});

			socket.emit('admin.social.savePostSharingNetworks', networks, function (err) {
				if (err) {
					return alerts.error(err);
				}

				alerts.success('[[admin/settings/social:save-success]]');
			});
		});
	};

	return social;
});
