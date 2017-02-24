'use strict';


define('admin/manage/registration', function () {
	var Registration = {};

	Registration.init = function () {
		$('.users-list').on('click', '[data-action]', function () {
			var parent = $(this).parents('[data-username]');
			var action = $(this).attr('data-action');
			var username = parent.attr('data-username');
			var method = action === 'accept' ? 'admin.user.acceptRegistration' : 'admin.user.rejectRegistration';

			socket.emit(method, { username: username }, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				parent.remove();
			});
			return false;
		});

		$('.invites-list').on('click', '[data-action]', function () {
			var parent = $(this).parents('[data-invitation-mail][data-invited-by]');
			var email = parent.attr('data-invitation-mail');
			var invitedBy = parent.attr('data-invited-by');
			var action = $(this).attr('data-action');
			var method = 'admin.user.deleteInvitation';

			var removeRow = function () {
				var nextRow = parent.next();
				var thisRowinvitedBy = parent.find('.invited-by');
				var nextRowInvitedBy = nextRow.find('.invited-by');
				if (nextRowInvitedBy.html() !== undefined && nextRowInvitedBy.html().length < 2) {
					nextRowInvitedBy.html(thisRowinvitedBy.html());
				}
				parent.remove();
			};
			if (action === 'delete') {
				bootbox.confirm('[[admin/manage/registration:invitations.confirm-delete]]', function (confirm) {
					if (confirm) {
						socket.emit(method, { email: email, invitedBy: invitedBy }, function (err) {
							if (err) {
								return app.alertError(err.message);
							}
							removeRow();
						});
					}
				});
			}
			return false;
		});
	};

	return Registration;
});
