'use strict';

define('forum/account/uploads', ['forum/account/header'], function (header) {
	const AccountUploads = {};

	AccountUploads.init = function () {
		header.init();

		$('[data-action="delete"]').on('click', function () {
			const el = $(this).parents('[data-name]');
			const name = el.attr('data-name');

			socket.emit('user.deleteUpload', { name: name, uid: ajaxify.data.uid }, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				el.remove();
			});
			return false;
		});
	};

	return AccountUploads;
});
