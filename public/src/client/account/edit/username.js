'use strict';

define('forum/account/edit/username', [
	'forum/account/header', 'api', 'slugify',
], function (header, api, slugify) {
	const AccountEditUsername = {};

	AccountEditUsername.init = function () {
		header.init();

		$('#submitBtn').on('click', function updateUsername() {
			const userData = {
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

			const btn = $(this);
			btn.addClass('disabled').find('i').removeClass('hide');

			api.put('/users/' + userData.uid, userData).then((response) => {
				const userslug = slugify(userData.username);
				if (userData.username && userslug && parseInt(userData.uid, 10) === parseInt(app.user.uid, 10)) {
					$('[component="header/profilelink"]').attr('href', config.relative_path + '/user/' + userslug);
					$('[component="header/profilelink/edit"]').attr('href', config.relative_path + '/user/' + userslug + '/edit');
					$('[component="header/profilelink/settings"]').attr('href', config.relative_path + '/user/' + userslug + '/settings');
					$('[component="header/username"]').text(userData.username);
					$('[component="header/usericon"]').css('background-color', response['icon:bgColor']).text(response['icon:text']);
					$('[component="avatar/icon"]').css('background-color', response['icon:bgColor']).text(response['icon:text']);
				}

				ajaxify.go('user/' + userslug + '/edit');
			}).catch(app.alertError)
				.finally(() => {
					btn.removeClass('disabled').find('i').addClass('hide');
				});

			return false;
		});
	};

	return AccountEditUsername;
});
