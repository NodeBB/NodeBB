'use strict';


define('admin/manage/registration', ['modals', 'alerts'], function (modals, alerts) {
	const Registration = {};

	Registration.init = function () {
		$('[data-action="reject-all"]').on('click', () => {
			modals.confirm('[[admin/manage/registration:reject-all-confirm]]', (ok) => {
				if (ok) {
					const rowEls = $('.users-list [data-username]');
					rowEls.each((index, rowEl) => {
						doAction($(rowEl), 'reject');
					});
				}
			});
		});

		function doAction(row, action) {
			const method = action === 'accept' ? 'user.acceptRegistration' : 'user.rejectRegistration';
			const username = row.attr('data-username');
			socket.emit(method, { username }, function (err) {
				if (err) {
					return alerts.error(err);
				}
				row.remove();
			});
		}

		$('.users-list').on('click', '[data-action]', function () {
			const rowEl = $(this).parents('[data-username]');
			const action = $(this).attr('data-action');
			doAction(rowEl, action);
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
				modals.confirm('[[admin/manage/registration:invitations.confirm-delete]]', function (confirm) {
					if (confirm) {
						socket.emit(method, { email: email, invitedBy: invitedBy }, function (err) {
							if (err) {
								return alerts.error(err);
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
