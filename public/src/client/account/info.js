'use strict';


define('forum/account/info', ['forum/account/header', 'components'], function (header, components) {
	var Info = {};

	Info.init = function () {
		header.init();
		handleModerationNote();
		prepareSessionRevoking();
	};

	function handleModerationNote() {
		$('[component="account/save-moderation-note"]').on('click', function () {
			var note = $('[component="account/moderation-note"]').val();
			socket.emit('user.setModerationNote', { uid: ajaxify.data.uid, note: note }, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				$('[component="account/moderation-note"]').val('');
				app.alertSuccess('[[user:info.moderation-note.success]]');
				var timestamp = Date.now();
				var data = [{
					note: note,
					user: app.user,
					timestamp: timestamp,
					timestampISO: utils.toISOString(timestamp),
				}];
				app.parseAndTranslate('account/info', 'moderationNotes', { moderationNotes: data }, function (html) {
					$('[component="account/moderation-note/list"]').prepend(html);
					html.find('.timeago').timeago();
				});
			});
		});
	}

	function prepareSessionRevoking() {
		components.get('user/sessions').on('click', '[data-action]', function () {
			var parentEl = $(this).parents('[data-uuid]');
			var uuid = parentEl.attr('data-uuid');

			if (uuid) {
				// This is done via DELETE because a user shouldn't be able to
				// revoke his own session! This is what logout is for
				$.ajax({
					url: config.relative_path + '/api/user/' + ajaxify.data.userslug + '/session/' + uuid,
					method: 'delete',
					headers: {
						'x-csrf-token': config.csrf_token,
					},
				}).done(function () {
					parentEl.remove();
				}).fail(function (err) {
					try {
						var errorObj = JSON.parse(err.responseText);
						if (errorObj.loggedIn === false) {
							window.location.href = config.relative_path + '/login?error=' + errorObj.title;
						}
						app.alertError(errorObj.title);
					} catch (e) {
						app.alertError('[[error:invalid-data]]');
					}
				});
			}
		});
	}

	return Info;
});
