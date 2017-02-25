'use strict';


define('admin/general/social', [], function () {
	var social = {};

	social.init = function () {
		$('#save').on('click', function () {
			var networks = [];
			$('#postSharingNetworks input[type="checkbox"]').each(function () {
				if ($(this).prop('checked')) {
					networks.push($(this).attr('id'));
				}
			});

			socket.emit('admin.social.savePostSharingNetworks', networks, function (err) {
				if (err) {
					return app.alertError(err);
				}

				app.alertSuccess('[[admin/general/social:save-success]]');
			});
		});
	};

	return social;
});
