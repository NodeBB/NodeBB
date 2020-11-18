'use strict';

define('accounts/delete', ['api', 'bootbox'], function (api) {
	var Delete = {};

	Delete.account = function (uid, callback) {
		executeAction(
			uid,
			'[[user:delete_this_account_confirm]]',
			'/account',
			'[[user:account-deleted]]',
			callback
		);
	};

	Delete.content = function (uid, callback) {
		executeAction(
			uid,
			'[[user:delete_account_content_confirm]]',
			'/content',
			'[[user:account-content-deleted]]',
			callback
		);
	};

	Delete.purge = function (uid, callback) {
		executeAction(
			uid,
			'[[user:delete_all_confirm]]',
			'',
			'[[user:account-deleted]]',
			callback
		);
	};

	function executeAction(uid, confirmText, path, successText, callback) {
		bootbox.confirm(confirmText, function (confirm) {
			if (!confirm) {
				return;
			}

			api.del(`/users/${uid}${path}`, {}).then(() => {
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
