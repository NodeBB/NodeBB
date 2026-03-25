'use strict';

import { get, post, del } from 'api';
import { error } from 'alerts';
import { render } from 'benchpress';
import { alert, dialog } from 'bootbox';

export function init() {
	setupBlocklists();
};

function setupBlocklists() {
	const blocklistsEl = document.getElementById('blocklists');
	if (blocklistsEl) {
		blocklistsEl.addEventListener('click', (e) => {
			const subselector = e.target.closest('[data-action]');
			if (subselector) {
				const url = subselector.closest('tr').getAttribute('data-url');
				const action = subselector.getAttribute('data-action');
				switch (action) {
					case 'blocklists.add': {
						throwModal();
						break;
					}

					case 'blocklists.refresh': {
						refresh(url);
						break;
					}

					case 'blocklists.view': {
						view(url);
						break;
					}

					case 'blocklists.remove': {
						del(`/admin/activitypub/blocklists/${encodeURIComponent(url)}`, {})
							.then(renderList)
							.catch(error);
					}
				}
			}
		});
	}
}

async function renderList(blocklists) {
	const html = await app.parseAndTranslate('admin/federation/safety', 'blocklists', { blocklists });
	const tbodyEl = document.querySelector('#blocklists tbody');
	if (tbodyEl) {
		$(tbodyEl).html(html);
	}
}

function throwModal() {
	render('admin/partials/activitypub/blocklists', {}).then(function (html) {
		const submit = function () {
			const formEl = modal.find('form').get(0);
			if (!formEl.reportValidity()) {
				return false;
			}

			const payload = Object.fromEntries(new FormData(formEl));
			post('/admin/activitypub/blocklists', payload).then(async (data) => {
				const html = await app.parseAndTranslate('admin/federation/safety', 'blocklists', { blocklists: data });
				const tbodyEl = document.querySelector('#blocklists tbody');
				if (tbodyEl) {
					$(tbodyEl).html(html);
				}
			}).catch(error);
		};
		const modal = bootbox.dialog({
			title: '[[admin/settings/activitypub:blocklists.add]]',
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

async function refresh(url) {
	try {
		const data = await post(`/admin/activitypub/blocklists/${encodeURIComponent(url)}/refresh`);
		alert(`[[admin/settings/activitypub:blocklists.refreshed, ${data.count}]]`);
		renderList(data.blocklists);
	} catch (e) {
		error(e);
	}
}

async function view(url) {
	console.log('ehjre');
	try {
		const { domains, count } = await get(`/admin/activitypub/blocklists/${encodeURIComponent(url)}`);
		dialog({
			title: '[[admin/settings/activitypub:blocklists.view.title]]',
			message: `\
				<p>[[admin/settings/activitypub:blocklists.view.intro, ${count}]]</p> \
				<ul>` + domains.map(domain => `<li>${domain}</li>`).join('\n') + '</ul>',
		});
	} catch (e) {
		error(e);
	}
}