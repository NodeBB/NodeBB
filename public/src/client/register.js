'use strict';


define('forum/register', ['translator', 'zxcvbn'], function (translator, zxcvbn) {
	var Register = {};
	var validationError = false;
	var successIcon = '';

	Register.init = function () {
		var email = $('#email');
		var username = $('#username');
		var password = $('#password');
		var password_confirm = $('#password-confirm');
		var register = $('#register');

		handleLanguageOverride();

		$('#referrer').val(app.previousUrl);
		$('#content #noscript').val('false');

		email.on('blur', function () {
			if (email.val().length) {
				validateEmail(email.val());
			}
		});

		var query = utils.params();
		if (query.email && query.token) {
			email.val(decodeURIComponent(query.email));
			$('#token').val(query.token);
		}

		// Update the "others can mention you via" text
		username.on('keyup', function () {
			$('#yourUsername').text(this.value.length > 0 ? utils.slugify(this.value) : 'username');
		});

		username.on('blur', function () {
			if (username.val().length) {
				validateUsername(username.val());
			}
		});

		password.on('blur', function () {
			if (password.val().length) {
				validatePassword(password.val(), password_confirm.val());
			}
		});

		password_confirm.on('blur', function () {
			if (password_confirm.val().length) {
				validatePasswordConfirm(password.val(), password_confirm.val());
			}
		});

		function validateForm(callback) {
			validationError = false;
			validatePassword(password.val(), password_confirm.val());
			validatePasswordConfirm(password.val(), password_confirm.val());

			validateEmail(email.val(), function () {
				validateUsername(username.val(), callback);
			});
		}

		register.on('click', function (e) {
			var registerBtn = $(this);
			var errorEl = $('#register-error-notify');
			errorEl.addClass('hidden');
			e.preventDefault();
			validateForm(function () {
				if (validationError) {
					return;
				}

				registerBtn.addClass('disabled');

				registerBtn.parents('form').ajaxSubmit({
					headers: {
						'x-csrf-token': config.csrf_token,
					},
					success: function (data) {
						registerBtn.removeClass('disabled');
						if (!data) {
							return;
						}
						if (data.referrer) {
							var pathname = utils.urlToLocation(data.referrer).pathname;

							var params = utils.params({ url: data.referrer });
							params.registered = true;
							var qs = decodeURIComponent($.param(params));

							window.location.href = pathname + '?' + qs;
						} else if (data.message) {
							translator.translate(data.message, function (msg) {
								bootbox.alert(msg);
								ajaxify.go('/');
							});
						}
					},
					error: function (data) {
						translator.translate(data.responseText, config.defaultLang, function (translated) {
							if (data.status === 403 && data.responseText === 'Forbidden') {
								window.location.href = config.relative_path + '/register?error=csrf-invalid';
							} else {
								errorEl.find('p').text(translated);
								errorEl.removeClass('hidden');
								registerBtn.removeClass('disabled');
							}
						});
					},
				});
			});
		});

		// Set initial focus
		$('#email').focus();
	};

	function validateEmail(email, callback) {
		callback = callback || function () {};
		var email_notify = $('#email-notify');

		if (!utils.isEmailValid(email)) {
			showError(email_notify, '[[error:invalid-email]]');
			return callback();
		}

		socket.emit('user.emailExists', {
			email: email,
		}, function (err, exists) {
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
		callback = callback || function () {};

		var username_notify = $('#username-notify');

		if (username.length < ajaxify.data.minimumUsernameLength) {
			showError(username_notify, '[[error:username-too-short]]');
		} else if (username.length > ajaxify.data.maximumUsernameLength) {
			showError(username_notify, '[[error:username-too-long]]');
		} else if (!utils.isUserNameValid(username) || !utils.slugify(username)) {
			showError(username_notify, '[[error:invalid-username]]');
		} else {
			socket.emit('user.exists', {
				username: username,
			}, function (err, exists) {
				if (err) {
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
		var password_notify = $('#password-notify');
		var password_confirm_notify = $('#password-confirm-notify');
		var passwordStrength = zxcvbn(password);

		if (password.length < ajaxify.data.minimumPasswordLength) {
			showError(password_notify, '[[reset_password:password_too_short]]');
		} else if (password.length > 512) {
			showError(password_notify, '[[error:password-too-long]]');
		} else if (!utils.isPasswordValid(password)) {
			showError(password_notify, '[[user:change_password_error]]');
		} else if (password === $('#username').val()) {
			showError(password_notify, '[[user:password_same_as_username]]');
		} else if (password === $('#email').val()) {
			showError(password_notify, '[[user:password_same_as_email]]');
		} else if (passwordStrength.score < ajaxify.data.minimumPasswordStrength) {
			showError(password_notify, '[[user:weak_password]]');
		} else {
			showSuccess(password_notify, successIcon);
		}

		if (password !== password_confirm && password_confirm !== '') {
			showError(password_confirm_notify, '[[user:change_password_error_match]]');
		}
	}

	function validatePasswordConfirm(password, password_confirm) {
		var password_notify = $('#password-notify');
		var password_confirm_notify = $('#password-confirm-notify');

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
		translator.translate(msg, function (msg) {
			element.html(msg);
			element.parent()
				.removeClass('register-success')
				.addClass('register-danger');
			element.show();
		});
		validationError = true;
	}

	function showSuccess(element, msg) {
		translator.translate(msg, function (msg) {
			element.html(msg);
			element.parent()
				.removeClass('register-danger')
				.addClass('register-success');
			element.show();
		});
	}

	function handleLanguageOverride() {
		if (!app.user.uid && config.defaultLang !== config.userLang) {
			var formEl = $('[component="register/local"]');
			var langEl = $('<input type="hidden" name="userLang" value="' + config.userLang + '" />');

			formEl.append(langEl);
		}
	}

	return Register;
});
