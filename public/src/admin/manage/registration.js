'use strict';


define('admin/manage/registration', ['bootbox'], function (bootbox) {
	const Registration = {};

	Registration.init = function () {
		$('.users-list').on('click', '[data-action]', function () {
			const parent = $(this).parents('[data-username]');
			const action = $(this).attr('data-action');
			const username = parent.attr('data-username');
			const method = action === 'accept' ? 'user.acceptRegistration' : 'user.rejectRegistration';

			socket.emit(method, { username: username }, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				parent.remove();
			});
			return false;
		});

		$('.invites-list').on('click', '[data-action]', function () {
			const parent = $(this).parents('[data-invitation-mail][data-invited-by]');
			const email = parent.attr('data-invitation-mail');
			const invitedBy = parent.attr('data-invited-by');
			const action = $(this).attr('data-action');
			const method = 'user.deleteInvitation';

			const removeRow = function () {
				const nextRow = parent.next();
				const thisRowinvitedBy = parent.find('.invited-by');
				const nextRowInvitedBy = nextRow.find('.invited-by');
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
