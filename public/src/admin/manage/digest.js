'use strict';


define('admin/manage/digest', function () {
	var Digest = {};

	Digest.init = function () {
		$('table').on('click', '[data-action]', function () {
			var action = this.getAttribute('data-action');
			var uid = this.getAttribute('data-uid');

			if (action.startsWith('resend-')) {
				var interval = action.slice(7);
				bootbox.confirm('[[admin/manage/digest:resend-all-confirm]]', function (ok) {
					if (ok) {
						Digest.send(action, undefined, function (err) {
							if (err) {
								return app.alertError(err);
							}

							app.alertSuccess('[[admin/manage/digest:resent-' + interval + ']]');
						});
					}
				});
			} else {
				Digest.send(action, uid, function (err) {
					if (err) {
						return app.alertError(err);
					}

					app.alertSuccess('[[admin/manage/digest:resent-single]]');
				});
			}
		});
	};

	Digest.send = function (action, uid, callback) {
		socket.emit('admin.digest.resend', {
			action: action,
			uid: uid,
		}, callback);
	};

	return Digest;
});
