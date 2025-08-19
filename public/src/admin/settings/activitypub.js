'use strict';

define('admin/settings/activitypub', [
	'benchpress',
	'bootbox',
	'categorySelector',
	'api',
], function (Benchpress, bootbox, categorySelector, api) {
	const Module = {};

	Module.init = function () {
		const rulesEl = document.getElementById('rules');
		if (rulesEl) {
			rulesEl.addEventListener('click', (e) => {
				const subselector = e.target.closest('[data-action]');
				if (subselector) {
					const action = subselector.getAttribute('data-action');
					switch (action) {
						case 'rules.add': {
							Module.throwRulesModal();
							break;
						}

						case 'rules.delete': {
							const rid = subselector.closest('tr').getAttribute('data-rid');
							api.del(`/admin/activitypub/rules/${rid}`, {}).then(async (data) => {
								const html = await Benchpress.render('admin/settings/activitypub', { rules: data }, 'rules');
								const tbodyEl = document.querySelector('#rules tbody');
								if (tbodyEl) {
									tbodyEl.innerHTML = html;
								}
							});
						}
					}
				}
			});
		}
	};

	Module.throwRulesModal = function () {
		Benchpress.render('admin/partials/activitypub/rules', {}).then(function (html) {
			const submit = function () {
				const formEl = modal.find('form').get(0);
				const payload = Object.fromEntries(new FormData(formEl));

				api.post('/admin/activitypub/rules', payload).then(async (data) => {
					const html = await Benchpress.render('admin/settings/activitypub', { rules: data }, 'rules');
					const tbodyEl = document.querySelector('#rules tbody');
					if (tbodyEl) {
						tbodyEl.innerHTML = html;
					}
				});
			};
			const modal = bootbox.dialog({
				title: '[[admin/settings/activitypub:rules.add]]',
				message: html,
				buttons: {
					save: {
						label: '[[global:save]]',
						className: 'btn-primary',
						callback: submit,
					},
				},
			});

			// category switcher
			categorySelector.init(modal.find('[component="category-selector"]'), {
				onSelect: function (selectedCategory) {
					modal.find('[name="cid"]').val(selectedCategory.cid);
				},
				cacheList: false,
				showLinks: true,
				template: 'admin/partials/category/selector-dropdown-right',
			});
		});
	};

	return Module;
});
