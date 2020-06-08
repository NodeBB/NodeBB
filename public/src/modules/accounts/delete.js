'use strict';

define('accounts/delete', [], function () {
	var Delete = {};

	Delete.account = function (uid, callback) {
		executeAction(
			uid,
			'[[user:delete_this_account_confirm]]',
			'admin.user.deleteUsers',
			'[[user:account-deleted]]',
			callback
		);
	};

	Delete.content = function (uid, callback) {
		executeAction(
			uid,
			'[[user:delete_account_content_confirm]]',
			'admin.user.deleteUsersContent',
			'[[user:account-content-deleted]]',
			callback
		);
	};

	Delete.purge = function (uid, callback) {
		executeAction(
			uid,
			'[[user:delete_all_confirm]]',
			'admin.user.deleteUsersAndContent',
			'[[user:account-deleted]]',
			callback
		);
	};

	function executeAction(uid, confirmText, action, successText, callback) {
		bootbox.confirm(confirmText, function (confirm) {
			if (!confirm) {
				return;
			}

			socket.emit(action, [uid], function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alertSuccess(successText);

				if (typeof callback === 'function') {
					return callback();
				}

				history.back();
			});
		});
	}

	return Delete;
});
