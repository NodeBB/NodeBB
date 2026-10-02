define('admin/manage/user/custom-reasons', [
	'admin/modules/listEditor',
], function (listEditor) {
	const manageCustomReasons = {};

	manageCustomReasons.init = function () {
		listEditor.init({
			attributes: {
				key: 'key',
				title: 'title',
				type: 'type',
				body: 'body',
			},
			modalTemplate: 'admin/partials/manage-custom-reasons-modal',
			rowTemplate: 'admin/manage/users/custom-reasons',
			rowBlock: 'reasons',
			createTitle: '[[admin/manage/custom-reasons:create-reason]]',
			editTitle: '[[admin/manage/custom-reasons:edit-reason]]',
			savedMessage: '[[admin/manage/custom-reasons:custom-reasons-saved]]',
			deleteConfirm: reason => `[[admin/manage/custom-reasons:delete-reason-confirm-x, "${reason.title}"]]`,
			prepare: async function (formData, reason) {
				formData.key = reason ? reason.key : Date.now();
				formData.parsedBody = await socket.emit('admin.parseRaw', formData.body);
				return formData;
			},
			onModalReady: function (modal, reason) {
				// bootbox translates message we want the translation keys to be preseved.
				if (reason && reason.body) {
					modal.find('[name="body"]').val(reason.body);
				}
			},
			save: reasons => socket.emit('admin.user.saveCustomReasons', reasons),
		});
	};

	return manageCustomReasons;
});
