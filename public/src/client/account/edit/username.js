'use strict';


define('forum/account/edit/username', ['forum/account/header'], function (header) {
	var AccountEditUsername = {};

	AccountEditUsername.init = function () {
		header.init();

		$('#submitBtn').on('click', function updateUsername() {
			var userData = {
				uid: $('#inputUID').val(),
				username: $('#inputNewUsername').val(),
				password: $('#inputCurrentPassword').val(),
			};

			if (!userData.username) {
				return;
			}

			if (userData.username === userData.password) {
				return app.alertError('[[user:username_same_as_password]]');
			}

			var btn = $(this);
			btn.addClass('disabled').find('i').removeClass('hide');

			$.ajax({
				url: config.relative_path + '/api/v1/users/' + userData.uid,
				data: userData,
				method: 'put',
			}).done(function (res) {
				btn.removeClass('disabled').find('i').addClass('hide');
				var userslug = utils.slugify(userData.username);
				if (userData.username && userslug && parseInt(userData.uid, 10) === parseInt(app.user.uid, 10)) {
					$('[component="header/profilelink"]').attr('href', config.relative_path + '/user/' + userslug);
					$('[component="header/profilelink/edit"]').attr('href', config.relative_path + '/user/' + userslug + '/edit');
					$('[component="header/profilelink/settings"]').attr('href', config.relative_path + '/user/' + userslug + '/settings');
					$('[component="header/username"]').text(userData.username);
					$('[component="header/usericon"]').css('background-color', res.response['icon:bgColor']).text(res.response['icon:text']);
				}

				ajaxify.go('user/' + userslug + '/edit');
			}).fail(function (ev) {
				app.alertError(ev.responseJSON.status.message);
			});

			return false;
		});
	};

	return AccountEditUsername;
});
