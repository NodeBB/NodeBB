'use strict';

define('forum/account/edit/password', [
	'forum/account/header', 'translator', 'zxcvbn', 'api', 'alerts',
], function (header, translator, zxcvbn, api, alerts) {
	const AccountEditPassword = {};

	AccountEditPassword.init = function () {
		header.init();

		handlePasswordChange();
	};

	function handlePasswordChange() {
		const currentPassword = $('#inputCurrentPassword');
		const password_notify = $('#password-notify');
		const password_confirm_notify = $('#password-confirm-notify');
		const password = $('#inputNewPassword');
		const password_confirm = $('#inputNewPasswordAgain');
		let passwordvalid = false;
		let passwordsmatch = false;

		function onPasswordChanged() {
			passwordvalid = false;

			try {
				utils.assertPasswordValidity(password.val());

				if (password.val() === ajaxify.data.username) {
					throw new Error('[[user:password_same_as_username]]');
				} else if (password.val() === ajaxify.data.email) {
					throw new Error('[[user:password_same_as_email]]');
				}

				showSuccess(password_notify);
				passwordvalid = true;
			} catch (err) {
				showError(password_notify, err.message);
			}
		}

		function onPasswordConfirmChanged() {
			if (password.val() !== password_confirm.val()) {
				showError(password_confirm_notify, '[[user:change_password_error_match]]');
				passwordsmatch = false;
			} else {
				if (password.val()) {
					showSuccess(password_confirm_notify);
				} else {
					password_confirm_notify.parent().removeClass('alert-success alert-danger');
					password_confirm_notify.children().show();
					password_confirm_notify.find('.msg').html('');
				}

				passwordsmatch = true;
			}
		}

		password.on('blur', onPasswordChanged);
		password_confirm.on('blur', onPasswordConfirmChanged);

		$('#changePasswordBtn').on('click', function () {
			onPasswordChanged();
			onPasswordConfirmChanged();

			const btn = $(this);
			if (passwordvalid && passwordsmatch) {
				btn.addClass('disabled').find('i').removeClass('hide');
				api.put('/users/' + ajaxify.data.theirid + '/password', {
					currentPassword: currentPassword.val(),
					newPassword: password.val(),
				})
					.then(() => {
						if (parseInt(app.user.uid, 10) === parseInt(ajaxify.data.uid, 10)) {
							window.location.href = config.relative_path + '/login';
						} else {
							ajaxify.go('user/' + ajaxify.data.userslug + '/edit');
						}
					})
					.finally(() => {
						btn.removeClass('disabled').find('i').addClass('hide');
						currentPassword.val('');
						password.val('');
						password_confirm.val('');
						password_notify.parent().removeClass('show-success show-danger');
						password_confirm_notify.parent().removeClass('show-success show-danger');
						passwordsmatch = false;
						passwordvalid = false;
					});
			} else {
				if (!passwordsmatch) {
					alerts.error('[[user:change_password_error_match]]');
				}

				if (!passwordvalid) {
					alerts.error('[[user:change_password_error]]');
				}
			}
			return false;
		});
	}

	function showError(element, msg) {
		translator.translate(msg, function (msg) {
			element.html(msg);

			element.parent()
				.removeClass('show-success')
				.addClass('show-danger');
		});
	}

	function showSuccess(element) {
		element.html('');
		element.parent()
			.removeClass('show-danger')
			.addClass('show-success');
	}

	return AccountEditPassword;
});
