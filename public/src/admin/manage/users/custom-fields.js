define('admin/manage/user/custom-fields', [
	'admin/modules/listEditor', 'iconSelect',
], function (listEditor, iconSelect) {
	const manageUserFields = {};

	manageUserFields.init = function () {
		listEditor.init({
			attributes: {
				key: 'key',
				name: 'name',
				icon: 'icon',
				type: 'type',
				'select-options': 'select-options',
				visibility: 'visibility',
				'min:rep': 'min-rep',
			},
			modalTemplate: 'admin/partials/manage-custom-user-fields-modal',
			rowTemplate: 'admin/manage/users/custom-fields',
			rowBlock: 'fields',
			createTitle: '[[admin/manage/user-custom-fields:create-field]]',
			editTitle: '[[admin/manage/user-custom-fields:edit-field]]',
			savedMessage: '[[admin/manage/user-custom-fields:custom-fields-saved]]',
			deleteConfirm: field => `[[admin/manage/user-custom-fields:delete-field-confirm-x, ${field.key}]]`,
			prepare: function (formData) {
				if (formData.type === 'select' || formData.type === 'select-multi') {
					formData.selectOptionsFormatted = formData['select-options'].trim().split('\n').join(', ');
				}
				return formData;
			},
			onModalReady: function (modal) {
				modal.find('#type-select').on('change', function () {
					const type = $(this).val();
					modal.find(`[data-input-type]`).addClass('hidden');
					modal.find(`[data-input-type-${type}]`).removeClass('hidden');
				});

				modal.find('#icon-select').on('click', function () {
					iconSelect.init($(this).find('i'), function (el, icon, styles) {
						styles.push(icon);
						modal.find('[name="icon"]').val(styles.join(' '));
					});
					return false;
				});
			},
			save: fields => socket.emit('admin.user.saveCustomFields', fields),
		});
	};

	return manageUserFields;
});
