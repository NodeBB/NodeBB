'use strict';


define('forum/registration', ['modals', 'alerts'], function (modals, alerts) {
	const Registration = {};

	// exposed so plugins adding bulk actions can read the current selection
	Registration.getSelectedUsernames = function (groupEl) {
		return $(groupEl)
			.find('[component="registration-queue/select/single"]:checked')
			.map((index, el) => $(el).attr('data-username'))
			.get();
	};

	Registration.init = function () {
		$('[data-bs-toggle="tooltip"]').tooltip();

		async function rejectUsernames(usernames) {
			await Promise.all(usernames.map(
				username => socket.emit('user.rejectRegistration', { username }).catch(alerts.error)
			));
			ajaxify.refresh();
		}

		$('[component="registration-queue/select/all"]').on('change', function () {
			$(this)
				.closest('.registration-queue-group')
				.find('[component="registration-queue/select/single"]')
				.prop('checked', $(this).is(':checked'));
		});

		$('[data-action="reject-all"]').on('click', () => {
			modals.confirm('[[registration-queue:reject-all-confirm]]', async (ok) => {
				if (ok) {
					await rejectUsernames($('.users-list tr[data-username]').map(
						(index, rowEl) => $(rowEl).attr('data-username')
					).get());
				}
			});
		});

		$('[data-action="reject-selected"]').on('click', function () {
			const usernames = Registration.getSelectedUsernames($(this).closest('.registration-queue-group'));
			if (!usernames.length) {
				return alerts.error('[[error:no-users-selected]]');
			}
			modals.confirm(`[[registration-queue:reject-selected-confirm, ${usernames.length}]]`, async (ok) => {
				if (ok) {
					await rejectUsernames(usernames);
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
				modals.confirm('[[registration-queue:invitations.confirm-delete]]', function (confirm) {
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
