'use strict';

define('admin/modules/change-email', [
	'api', 'bootbox', 'alerts',
], function (api, bootbox, alerts) {
	const ChangeEmail = {};

	ChangeEmail.init = function (params) {
		const modal = bootbox.dialog({
			message: `
				<label class="form-label">[[admin/manage/users:new-email]]</label>
				<input id="newEmail" class="form-control" type="text" value="${utils.escapeHTML(params.email || '')}">
			`,
			title: '[[admin/manage/users:change-email]]',
			onEscape: true,
			buttons: {
				cancel: {
					label: '[[admin/manage/users:alerts.button-cancel]]',
					className: 'btn-link',
				},
				change: {
					label: '[[admin/manage/users:alerts.button-change]]',
					className: 'btn-primary',
					callback: function () {
						const newEmail = modal.find('#newEmail').val();
						api.post('/users/' + params.uid + '/emails', {
							skipConfirmation: true,
							email: newEmail,
						}).then(() => {
							modal.modal('hide');
							params.onSuccess(newEmail);
						}).catch(alerts.error);
						return false;
					},
				},
			},
		});
	};

	return ChangeEmail;
});
