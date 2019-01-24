'use strict';


define('forum/account/edit/email', ['forum/account/header'], function (header) {
	var AccountEditEmail = {};

	AccountEditEmail.init = function () {
		header.init();

		$('#submitBtn').on('click', function () {
			var curPasswordEl = $('#inputCurrentPassword');
			var userData = {
				uid: $('#inputUID').val(),
				email: $('#inputNewEmail').val(),
				password: curPasswordEl.val(),
			};

			if (!userData.email) {
				return;
			}

			if (userData.email === userData.password) {
				curPasswordEl.parents('.control-group').toggleClass('has-error', true);
				return app.alertError('[[user:email_same_as_password]]');
			}

			var btn = $(this);
			btn.addClass('disabled').find('i').removeClass('hide');

			socket.emit('user.changeUsernameEmail', userData, function (err) {
				btn.removeClass('disabled').find('i').addClass('hide');
				if (err) {
					return app.alertError(err.message);
				}

				ajaxify.go('user/' + ajaxify.data.userslug + '/edit');
			});

			return false;
		});
	};

	return AccountEditEmail;
});
