'use strict';

define('admin/modules/listEditor', [
	'benchpress', 'modals', 'alerts', 'jquery-ui/widgets/sortable',
], function (Benchpress, modals, alerts) {
	const listEditor = {};

	listEditor.init = function (options) {
		const table = $('table');

		table.on('click', '[data-action="edit"]', function () {
			const row = $(this).parents('[data-key]');
			showModal(options, getDataFromEl(options, row));
		});

		table.on('click', '[data-action="delete"]', function () {
			const row = $(this).parents('[data-key]');
			modals.confirm(options.deleteConfirm(getDataFromEl(options, row)), function (ok) {
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

		$('#new').on('click', () => showModal(options));

		$('#save').on('click', async () => {
			const items = [];
			$('tbody tr[data-key]').each((index, el) => {
				items.push(getDataFromEl(options, $(el)));
			});
			try {
				await options.save(items);
				alerts.success(options.savedMessage);
			} catch (err) {
				alerts.error(err);
			}
		});
	};

	function getDataFromEl(options, el) {
		const data = {};
		Object.keys(options.attributes).forEach((prop) => {
			data[prop] = el.attr(`data-${options.attributes[prop]}`);
		});
		return data;
	}

	async function showModal(options, item = null) {
		const html = await Benchpress.render(options.modalTemplate, item);

		const modal = await modals.dialog({
			message: html,
			onEscape: true,
			title: item ? options.editTitle : options.createTitle,
			buttons: {
				submit: {
					label: '[[global:save]]',
					callback: async function () {
						let formData = modal.find('form').serializeObject();
						if (options.prepare) {
							formData = await options.prepare(formData, item);
						}

						app.parseAndTranslate(options.rowTemplate, options.rowBlock, {
							[options.rowBlock]: [formData],
						}, (html) => {
							if (item) {
								$(`tbody [data-key="${item.key}"]`).replaceWith(html);
							} else {
								$('tbody').append(html);
							}
						});
					},
				},
			},
		});

		if (options.onModalReady) {
			options.onModalReady(modal, item);
		}
	}

	return listEditor;
});
