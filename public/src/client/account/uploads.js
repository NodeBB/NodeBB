'use strict';

define('forum/account/uploads', ['forum/account/header'], function (header) {
	var AccountUploads = {};

	AccountUploads.init = function () {
		header.init();

		$('[data-action="delete"]').on('click', function () {
			var el = $(this).parents('[data-url]');
			var url = el.attr('data-url');

			socket.emit('user.deleteUpload', { url: url, uid: ajaxify.data.uid }, function (err) {
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
