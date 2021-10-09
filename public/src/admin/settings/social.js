'use strict';


define('admin/settings/social', [], function () {
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
					return app.alertError(err);
				}

				app.alertSuccess('[[admin/settings/social:save-success]]');
			});
		});
	};

	return social;
});
