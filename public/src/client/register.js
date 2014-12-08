'use strict';

/* globals define, app, utils, socket, config, translator */


define('forum/register', ['csrf'], function(csrf) {
	var Register = {},
		validationError = false,
		successIcon = '<i class="fa fa-check"></i>';

	Register.init = function() {
		var email = $('#email'),
			username = $('#username'),
			password = $('#password'),
			password_confirm = $('#password-confirm'),
			register = $('#register'),
			agreeTerms = $('#agree-terms');

		$('#referrer').val(app.previousUrl);

		email.on('blur', function() {
			if (email.val().length) {
				validateEmail(email.val());
			}
		});

		username.on('keyup', function() {
			$('#yourUsername').text(this.value.length > 0 ? this.value : 'username');
		});

		username.on('blur', function() {
			if (username.val().length) {
				validateUsername(username.val());
			}
		});

		password.on('blur', function() {
			if (password.val().length) {
				validatePassword(password.val(), password_confirm.val());
			}
		});

		password_confirm.on('blur', function() {
			if (password_confirm.val().length) {
				validatePasswordConfirm(password.val(), password_confirm.val());
			}
		});

		function validateForm(callback) {
			validationError = false;
			validatePassword(password.val(), password_confirm.val());
			validatePasswordConfirm(password.val(), password_confirm.val());

			validateEmail(email.val(), function() {
				validateUsername(username.val(), callback);
			});
		}

		register.on('click', function(e) {
			var registerBtn = $(this);
			e.preventDefault();
			validateForm(function() {
				if (!validationError) {
					registerBtn.addClass('disabled');

					registerBtn.parents('form').ajaxSubmit({
						headers: {
							'x-csrf-token': csrf.get()
						},
						success: function(data, status) {
							window.location.href = data;
						},
						error: function(data, status) {
							var errorEl = $('#register-error-notify');
							translator.translate(data.responseText, config.defaultLang, function(translated) {
								errorEl.find('p').text(translated);
								errorEl.show();
								registerBtn.removeClass('disabled');
							});
						}
					});
				}
			});
		});

		if(agreeTerms.length) {
			agreeTerms.on('click', function() {
				if ($(this).prop('checked')) {
					register.removeAttr('disabled');
				} else {
					register.attr('disabled', 'disabled');
				}
			});

			register.attr('disabled', 'disabled');
		}
	};

	function validateEmail(email, callback) {
		callback = callback || function() {};
		var email_notify = $('#email-notify');

		if (!utils.isEmailValid(email)) {
			showError(email_notify, '[[error:invalid-email]]');
			return callback();
		}

		socket.emit('user.emailExists', {
			email: email
		}, function(err, exists) {
			if (err) {
				app.alertError(err.message);
				return callback();
			}

			if (exists) {
				showError(email_notify, '[[error:email-taken]]');
			} else {
				showSuccess(email_notify, successIcon);
			}

			callback();
		});
	}

	function validateUsername(username, callback) {
		callback = callback || function() {};

		var username_notify = $('#username-notify');

		if (username.length < config.minimumUsernameLength) {
			showError(username_notify, '[[error:username-too-short]]');
		} else if (username.length > config.maximumUsernameLength) {
			showError(username_notify, '[[error:username-too-long]]');
		} else if (!utils.isUserNameValid(username) || !utils.slugify(username)) {
			showError(username_notify, '[[error:invalid-username]]');
		} else {
			socket.emit('user.exists', {
				username: username
			}, function(err, exists) {
				if(err) {
					return app.alertError(err.message);
				}

				if (exists) {
					showError(username_notify, '[[error:username-taken]]');
				} else {
					showSuccess(username_notify, successIcon);
				}

				callback();
			});
		}
	}

	function validatePassword(password, password_confirm) {
		var password_notify = $('#password-notify'),
			password_confirm_notify = $('#password-confirm-notify');

		if (password.length < config.minimumPasswordLength) {
			showError(password_notify, '[[user:change_password_error_length]]');
		} else if (!utils.isPasswordValid(password)) {
			showError(password_notify, '[[user:change_password_error]]');
		} else {
			showSuccess(password_notify, successIcon);
		}

		if (password !== password_confirm && password_confirm !== '') {
			showError(password_confirm_notify, '[[user:change_password_error_match]]');
		}
	}

	function validatePasswordConfirm(password, password_confirm) {
		var password_notify = $('#password-notify'),
			password_confirm_notify = $('#password-confirm-notify');

		if (!password || password_notify.hasClass('alert-error')) {
			return;
		}

		if (password !== password_confirm) {
			showError(password_confirm_notify, '[[user:change_password_error_match]]');
		} else {
			showSuccess(password_confirm_notify, successIcon);
		}
	}

	function showError(element, msg) {
		translator.translate(msg, function(msg) {
			element.html(msg);
			element.parent()
				.removeClass('alert-success')
				.addClass('alert-danger');
			element.show();
		});
		validationError = true;
	}

	function showSuccess(element, msg) {
		translator.translate(msg, function(msg) {
			element.html(msg);
			element.parent()
				.removeClass('alert-danger')
				.addClass('alert-success');
			element.show();
		});
	}


	return Register;
});
