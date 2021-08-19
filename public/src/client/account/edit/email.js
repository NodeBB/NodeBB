'use strict';

define('forum/account/edit/email', ['forum/account/header', 'api'], function (header, api) {
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

			api.put('/users/' + userData.uid, userData).then((res) => {
				btn.removeClass('disabled').find('i').addClass('hide');
				ajaxify.go('user/' + res.userslug + '/edit');
			}).catch((err) => {
				setTimeout(() => {
					btn.removeClass('disabled').find('i').addClass('hide');
					app.alertError(err);
				}, 300); // for UX: this call is too fast.
			});

			return false;
		});
	};

	return AccountEditEmail;
});
