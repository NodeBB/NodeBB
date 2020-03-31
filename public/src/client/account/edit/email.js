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

			$.ajax({
				url: config.relative_path + '/api/v1/users/' + userData.uid,
				data: userData,
				method: 'put',
			}).done(function (res) {
				btn.removeClass('disabled').find('i').addClass('hide');
				ajaxify.go('user/' + res.response.userslug + '/edit');
			}).fail(function (ev) {
				app.alertError(ev.responseJSON.status.message);
			});

			return false;
		});
	};

	return AccountEditEmail;
});
