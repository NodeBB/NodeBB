'use strict';


define('admin/manage/digest', ['bootbox', 'alerts'], function (bootbox, alerts) {
	const Digest = {};

	Digest.init = function () {
		$('table').on('click', '[data-action]', function () {
			const action = this.getAttribute('data-action');
			const uid = this.getAttribute('data-uid');

			if (action.startsWith('resend-')) {
				const interval = action.slice(7);
				bootbox.confirm('[[admin/manage/digest:resend-all-confirm]]', function (ok) {
					if (ok) {
						Digest.send(action, undefined, function (err) {
							if (err) {
								return alerts.error(err);
							}

							alerts.success('[[admin/manage/digest:resent-' + interval + ']]');
						});
					}
				});
			} else {
				Digest.send(action, uid, function (err) {
					if (err) {
						return alerts.error(err);
					}

					alerts.success('[[admin/manage/digest:resent-single]]');
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
