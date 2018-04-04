'use strict';


define('forum/account/edit/password', ['forum/account/header', 'translator', 'zxcvbn'], function (header, translator, zxcvbn) {
	var AccountEditPassword = {};

	AccountEditPassword.init = function () {
		header.init();

		handlePasswordChange();
	};

	function handlePasswordChange() {
		var currentPassword = $('#inputCurrentPassword');
		var password_notify = $('#password-notify');
		var password_confirm_notify = $('#password-confirm-notify');
		var password = $('#inputNewPassword');
		var password_confirm = $('#inputNewPasswordAgain');
		var passwordvalid = false;
		var passwordsmatch = false;

		function onPasswordChanged() {
			var passwordStrength = zxcvbn(password.val());
			passwordvalid = false;
			if (password.val().length < ajaxify.data.minimumPasswordLength) {
				showError(password_notify, '[[reset_password:password_too_short]]');
			} else if (password.val().length > 512) {
				showError(password_notify, '[[error:password-too-long]]');
			} else if (!utils.isPasswordValid(password.val())) {
				showError(password_notify, '[[user:change_password_error]]');
			} else if (password.val() === ajaxify.data.username) {
				showError(password_notify, '[[user:password_same_as_username]]');
			} else if (password.val() === ajaxify.data.email) {
				showError(password_notify, '[[user:password_same_as_email]]');
			} else if (passwordStrength.score < ajaxify.data.minimumPasswordStrength) {
				showError(password_notify, '[[user:weak_password]]');
			} else {
				showSuccess(password_notify);
				passwordvalid = true;
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

			var btn = $(this);
			if (passwordvalid && passwordsmatch) {
				btn.addClass('disabled').find('i').removeClass('hide');
				socket.emit('user.changePassword', {
					currentPassword: currentPassword.val(),
					newPassword: password.val(),
					uid: ajaxify.data.theirid,
				}, function (err) {
					btn.removeClass('disabled').find('i').addClass('hide');
					currentPassword.val('');
					password.val('');
					password_confirm.val('');
					passwordsmatch = false;
					passwordvalid = false;

					if (err) {
						onPasswordChanged();
						onPasswordConfirmChanged();
						return app.alertError(err.message);
					}
					if (parseInt(app.user.uid, 10) === parseInt(ajaxify.data.uid, 10)) {
						window.location.href = config.relative_path + '/login';
					} else {
						ajaxify.go('user/' + ajaxify.data.userslug + '/edit');
					}
				});
			} else {
				if (!passwordsmatch) {
					app.alertError('[[user:change_password_error_match]]');
				}

				if (!passwordvalid) {
					app.alertError('[[user:change_password_error]]');
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
