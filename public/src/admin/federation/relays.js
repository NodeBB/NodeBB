'use strict';

import { post, del } from 'api';
import { error } from 'alerts';
import { render } from 'benchpress';

export function init() {
	setupRelays();
};

function setupRelays() {
	const relaysEl = document.getElementById('relays');
	if (relaysEl) {
		relaysEl.addEventListener('click', (e) => {
			const subselector = e.target.closest('[data-action]');
			if (subselector) {
				const action = subselector.getAttribute('data-action');
				switch (action) {
					case 'relays.add': {
						throwModal();
						break;
					}

					case 'relays.remove': {
						const url = subselector.closest('tr').getAttribute('data-url');
						del(`/admin/activitypub/relays/${encodeURIComponent(url)}`, {}).then(async (data) => {
							const html = await app.parseAndTranslate('admin/settings/activitypub', 'relays', { relays: data });
							const tbodyEl = document.querySelector('#relays tbody');
							if (tbodyEl) {
								$(tbodyEl).html(html);
							}
						}).catch(error);
					}
				}
			}
		});
	}
}

function throwModal() {
	render('admin/partials/activitypub/relays', {}).then(function (html) {
		const submit = function () {
			const formEl = modal.find('form').get(0);
			const payload = Object.fromEntries(new FormData(formEl));

			post('/admin/activitypub/relays', payload).then(async (data) => {
				const html = await app.parseAndTranslate('admin/settings/activitypub', 'relays', { relays: data });
				const tbodyEl = document.querySelector('#relays tbody');
				if (tbodyEl) {
					$(tbodyEl).html(html);
				}
			}).catch(error);
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
}