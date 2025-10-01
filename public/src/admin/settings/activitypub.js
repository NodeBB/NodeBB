'use strict';

define('admin/settings/activitypub', [
	'benchpress',
	'bootbox',
	'categorySelector',
	'api',
	'alerts',
	'translator',
], function (Benchpress, bootbox, categorySelector, api, alerts, translator) {
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
							}).catch(alerts.error);
						}
					}
				}
			});
		}

		const relaysEl = document.getElementById('relays');
		if (relaysEl) {
			relaysEl.addEventListener('click', (e) => {
				const subselector = e.target.closest('[data-action]');
				if (subselector) {
					const action = subselector.getAttribute('data-action');
					switch (action) {
						case 'relays.add': {
							Module.throwRelaysModal();
							break;
						}

						case 'relays.remove': {
							const url = subselector.closest('tr').getAttribute('data-url');
							api.del(`/admin/activitypub/relays/${encodeURIComponent(url)}`, {}).then(async (data) => {
								const html = await app.parseAndTranslate('admin/settings/activitypub', 'relays', { relays: data });
								const tbodyEl = document.querySelector('#relays tbody');
								if (tbodyEl) {
									$(tbodyEl).html(html);
								}
							}).catch(alerts.error);
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
				}).catch(alerts.error);
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

			modal.on('shown.bs.modal', function () {
				modal.find('input').focus();
			});


			// help text
			const updateHelp = async (key, el) => {
				const text = await translator.translate(`[[admin/settings/activitypub:rules.help-${key}]]`);
				el.innerHTML = text;
			};
			const helpTextEl = modal.get(0).querySelector('#help-text');
			const typeEl = modal.get(0).querySelector('#type');
			updateHelp(modal.get(0).querySelector('#type option').value, helpTextEl);
			if (typeEl && helpTextEl) {
				typeEl.addEventListener('change', function () {
					updateHelp(this.value, helpTextEl);
				});
			}

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

	Module.throwRelaysModal = function () {
		Benchpress.render('admin/partials/activitypub/relays', {}).then(function (html) {
			const submit = function () {
				const formEl = modal.find('form').get(0);
				const payload = Object.fromEntries(new FormData(formEl));

				api.post('/admin/activitypub/relays', payload).then(async (data) => {
					const html = await app.parseAndTranslate('admin/settings/activitypub', 'relays', { relays: data });
					const tbodyEl = document.querySelector('#relays tbody');
					if (tbodyEl) {
						$(tbodyEl).html(html);
					}
				}).catch(alerts.error);
			};
			const modal = bootbox.dialog({
				title: '[[admin/settings/activitypub:relays.add]]',
				message: html,
				buttons: {
					save: {
						label: '[[global:save]]',
						className: 'btn-primary',
						callback: submit,
					},
				},
			});

			modal.on('shown.bs.modal', function () {
				modal.find('input').focus();
			});
		});
	};

	return Module;
});
