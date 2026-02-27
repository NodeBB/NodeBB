'use strict';

import { post, del, put } from 'api';
import { error } from 'alerts';
import { render } from 'benchpress';
import { translate } from 'translator';
import * as categorySelector from 'categorySelector';

export function init() {
	setupRules();
};

function setupRules() {
	const rulesEl = document.getElementById('rules');
	if (!rulesEl) {
		return;
	}

	rulesEl.addEventListener('click', (e) => {
		const subselector = e.target.closest('[data-action]');
		if (subselector) {
			const action = subselector.getAttribute('data-action');
			switch (action) {
				case 'rules.add': {
					throwModal();
					break;
				}

				case 'rules.delete': {
					const rid = subselector.closest('tr').getAttribute('data-rid');
					del(`/admin/activitypub/rules/${rid}`, {}).then(async (data) => {
						const html = await render('admin/settings/activitypub', { rules: data }, 'rules');
						const tbodyEl = document.querySelector('#rules tbody');
						if (tbodyEl) {
							tbodyEl.innerHTML = html;
						}
					}).catch(error);
				}
			}
		}
	});

	const tbodyEl = $(rulesEl).find('tbody');
	tbodyEl.sortable({
		handle: '.drag-handle',
		helper: fixWidthHelper,
		placeholder: 'ui-state-highlight',
		axis: 'y',
		update: function () {
			const rids = [];
			tbodyEl.find('tr').each(function () {
				rids.push($(this).data('rid'));
			});

			put('/admin/activitypub/rules/order', { rids }).catch(error);
		},
	});

	function fixWidthHelper(e, ui) {
		ui.children().each(function () {
			$(this).width($(this).width());
		});
		return ui;
	}
}

function throwModal() {
	render('admin/partials/activitypub/rules', {}).then(function (html) {
		const submit = function () {
			const formEl = modal.find('form').get(0);
			const payload = Object.fromEntries(new FormData(formEl));

			post('/admin/activitypub/rules', payload).then(async (data) => {
				const html = await render('admin/settings/activitypub', { rules: data }, 'rules');
				const tbodyEl = document.querySelector('#rules tbody');
				if (tbodyEl) {
					tbodyEl.innerHTML = html;
				}
			}).catch(error);
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
			const text = await translate(`[[admin/settings/activitypub:rules.help-${key}]]`);
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
}