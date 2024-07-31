define('admin/manage/user/custom-fields', ['bootbox', 'alerts', 'jquery-ui/widgets/sortable'], function (bootbox, alerts) {
	const manageUserFields = {};

	manageUserFields.init = function () {
		const table = $('table');

		table.on('click', '[data-action="edit"]', function () {
			const row = $(this).parents('[data-key]');
			const field = {
				key: row.attr('data-key'),
				name: row.attr('data-name'),
				type: row.attr('data-type'),
				'select-options': row.attr('data-select-options'),
			};
			showModal(field);
		});

		table.on('click', '[data-action="delete"]', function () {
			const key = $(this).attr('data-key');
			const row = $(this).parents('[data-key]');
			bootbox.confirm(`[[admin/manage/user-custom-fields:delete-field-confirm-x, ${key}]]`, function (ok) {
				if (!ok) {
					return;
				}
				row.remove();
			});
		});

		$('tbody').sortable({
			handle: '[component="sort/handle"]',
			axis: 'y',
			zIndex: 9999,
		});

		$('#new').on('click', () => showModal());

		$('#save').on('click', () => {
			const fields = [];
			$('tbody tr[data-key]').each((index, el) => {
				const $el = $(el);
				fields.push({
					key: $el.attr('data-key'),
					name: $el.attr('data-name'),
					type: $el.attr('data-type'),
					'select-options': $el.attr('data-select-options'),
				});
			});
			socket.emit('admin.user.saveCustomFields', fields, function (err) {
				if (err) {
					alerts.error(err);
				}
				alerts.success('[[admin/manage/user-custom-fields:custom-fields-saved]]');
			});
		});
	};

	async function showModal(field = null) {
		const html = await app.parseAndTranslate('admin/partials/manage-custom-user-fields-modal', field);

		const modal = bootbox.dialog({
			message: html,
			onEscape: true,
			title: field ?
				'[[admin/manage/user-custom-fields:edit-field]]' :
				'[[admin/manage/user-custom-fields:create-field]]',
			buttons: {
				submit: {
					label: '[[global:save]]',
					callback: function () {
						const formData = modal.find('form').serializeObject();
						if (formData.type === 'select') {
							formData.selectOptionsFormatted = formData['select-options'].trim().split('\n').join(', ');
						}

						app.parseAndTranslate('admin/manage/users/custom-fields', 'fields', {
							fields: [formData],
						}, (html) => {
							if (field) {
								const oldKey = field.key;
								$(`tbody [data-key="${oldKey}"]`).replaceWith(html);
							} else {
								$('tbody').append(html);
							}
						});
					},
				},
			},
		});

		modal.find('#type-select').on('change', function () {
			const type = $(this).val();
			modal.find(`[data-input-type]`).addClass('hidden');
			modal.find(`[data-input-type="${type}"]`).removeClass('hidden');
		});
	}

	return manageUserFields;
});


