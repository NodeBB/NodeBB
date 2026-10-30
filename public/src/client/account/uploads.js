'use strict';

define('forum/account/uploads', ['forum/account/header', 'alerts', 'modals'], function (header, alerts, modals) {
	const AccountUploads = {};

	AccountUploads.init = function () {
		header.init();

		$('[data-action="delete"]').on('click', function () {
			const el = $(this).parents('[data-name]');
			const name = el.attr('data-name');
			modals.confirm('[[uploads:delete-upload-confirm]]', function (ok) {
				if (!ok) return;
				socket.emit('user.deleteUpload', { name: name, uid: ajaxify.data.uid }, function (err) {
					if (err) {
						return alerts.error(err);
					}
					el.remove();
				});
			});
			return false;
		});
	};

	return AccountUploads;
});
