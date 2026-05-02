define('admin/manage/user/custom-reasons', [
	'benchpress', 'bootbox', 'alerts', 'translator', 'jquery-ui/widgets/sortable',
], function (benchpress, bootbox, alerts, translator) {
	const manageCustomReasons = {};

	manageCustomReasons.init = function () {
		const table = $('table');

		$('#new').on('click', () => showModal());

		table.on('click', '[data-action="edit"]', function () {
			const row = $(this).parents('[data-key]');
			showModal(getDataFromEl(row));
		});

		table.on('click', '[data-action="delete"]', function () {
			const row = $(this).parents('[data-key]');
			const title = row.attr('data-title');
			bootbox.confirm(`[[admin/manage/custom-reasons:delete-reason-confirm-x, "${title}"]]`, function (ok) {
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

		$('#save').on('click', () => {
			const reasons = [];
			$('tbody tr[data-key]').each((index, el) => {
				reasons.push(getDataFromEl($(el)));
			});
			socket.emit('admin.user.saveCustomReasons', reasons, function (err) {
				if (err) {
					return alerts.error(err);
				}
				alerts.success('[[admin/manage/custom-reasons:custom-reasons-saved]]');
			});
		});
	};

	function getDataFromEl(el) {
		return {
			key: el.attr('data-key'),
			title: el.attr('data-title'),
			type: el.attr('data-type'),
			body: el.attr('data-body'),
		};
	}

	async function showModal(reason = null) {
		const html = await benchpress.render('admin/partials/manage-custom-reasons-modal', reason);
		const modal = bootbox.dialog({
			message: html,
			onEscape: true,
			title: reason ?
				'[[admin/manage/custom-reasons:edit-reason]]' :
				'[[admin/manage/custom-reasons:create-reason]]',
			buttons: {
				submit: {
					label: '[[global:save]]',
					callback: async function () {
						const formData = modal.find('form').serializeObject();
						formData.key = reason ? reason.key : Date.now();
						formData.body = translator.escape(formData.body);
						formData.parsedBody = translator.escape(await socket.emit('admin.parseRaw', formData.body));

						app.parseAndTranslate('admin/manage/users/custom-reasons', 'reasons', {
							reasons: [formData],
						}, (html) => {
							if (reason) {
								const oldKey = reason.key;
								$(`tbody [data-key="${oldKey}"]`).replaceWith(html);
							} else {
								$('tbody').append(html);
							}
						});
					},
				},
			},
		});
		// bootbox translates message we want the translation keys to be preseved.
		if (reason && reason.body) {
			modal.find('[name="body"]').val(reason.body);
		}
	}


	return manageCustomReasons;
});


