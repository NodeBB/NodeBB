define('admin/manage/user/custom-fields', [
	'bootbox', 'alerts', 'iconSelect', 'jquery-ui/widgets/sortable',
], function (bootbox, alerts, iconSelect) {
	const manageUserFields = {};

	manageUserFields.init = function () {
		const table = $('table');

		table.on('click', '[data-action="edit"]', function () {
			const row = $(this).parents('[data-key]');
			showModal(getDataFromEl(row));
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
				fields.push(getDataFromEl($(el)));
			});
			socket.emit('admin.user.saveCustomFields', fields, function (err) {
				if (err) {
					return alerts.error(err);
				}
				alerts.success('[[admin/manage/user-custom-fields:custom-fields-saved]]');
			});
		});
	};

	function getDataFromEl(el) {
		return {
			key: el.attr('data-key'),
			name: el.attr('data-name'),
			icon: el.attr('data-icon'),
			type: el.attr('data-type'),
			'select-options': el.attr('data-select-options'),
			visibility: el.attr('data-visibility'),
			'min:rep': el.attr('data-min-rep'),
		};
	}

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
						if (formData.type === 'select' || formData.type === 'select-multi') {
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
			modal.find(`[data-input-type-${type}]`).removeClass('hidden');
		});

		modal.find('#icon-select').on('click', function () {
			iconSelect.init($(this).find('i'), function (el, icon, styles) {
				styles.push(icon);
				modal.find('[name="icon"]').val(styles.join(' '));
			});
			return false;
		});
	}

	return manageUserFields;
});


