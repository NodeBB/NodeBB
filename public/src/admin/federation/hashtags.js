'use strict';

import { post, del, put } from 'api';
import { error, success } from 'alerts';
import { render } from 'benchpress';
import * as categorySelector from 'categorySelector';
import * as modals from 'modals';

export async function init() {
	setupHashtags();
	setupRelay();
}

function setupHashtags() {
	const hashtagsEl = document.getElementById('hashtags');
	if (!hashtagsEl) {
		return;
	}

	hashtagsEl.addEventListener('click', (e) => {
		const subselector = e.target.closest('[data-action]');
		if (!subselector) {
			return;
		}

		const action = subselector.getAttribute('data-action');

		switch (action) {
			case 'hashtags.add': {
				throwModal();
				break;
			}

			case 'hashtags.remove': {
				const tag = subselector.getAttribute('data-tag');
				del(`/admin/activitypub/hashtags/${encodeURIComponent(tag)}`).then(async (data) => {
					const html = await app.parseAndTranslate('admin/partials/activitypub/hashtags/list', {}, {
						hashtags: data.map(h => ({
							...h,
							stateClass: getStateClass(h.state),
						})),
					});
					const listEl = document.querySelector('[component="hashtags/list"]');
					if (listEl) {
						$(listEl).html(html);
					}
				}).catch(error);
				break;
			}
		}
	});
}

function setupRelay() {
	const setRelayBtn = document.querySelector('[data-action="hashtags.setRelay"]');
	if (!setRelayBtn) {
		return;
	}

	setRelayBtn.addEventListener('click', () => {
		const relayHostEl = document.getElementById('relayHost');
		const host = relayHostEl ? relayHostEl.value : '';
		if (!host) {
			error('[[error:invalid-data]]');
			return;
		}

		put('/admin/activitypub/hashtags/relay', { host }).then(async () => {
			success('[[success:settings-updated]]');
			ajaxify.data.relay = host;
		}).catch(error);
	});
}

function throwModal() {
	render('admin/partials/activitypub/hashtags', {}).then(async function (html) {
		const submit = function () {
			const formEl = modal.find('form').get(0);
			if (!formEl.reportValidity()) {
				return false;
			}

			const payload = Object.fromEntries(new FormData(formEl));
			post('/admin/activitypub/hashtags', payload).then(async (data) => {
				const html = await app.parseAndTranslate('admin/partials/activitypub/hashtags/list', {}, {
					hashtags: data.map(h => ({
						...h,
						stateClass: getStateClass(h.state),
					})),
				});
				const listEl = document.querySelector('[component="hashtags/list"]');
				if (listEl) {
					$(listEl).html(html);
				}
				modal.modal('hide');
			}).catch(error);

			return false;
		};

		const modal = await modals.dialog({
			title: '[[admin/settings/activitypub:hashtags.follow]]',
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
			modal.find('#hashtagTag').focus();
		});

		// category selector
		categorySelector.init(modal.find('[component="category-selector"]'), {
			onSelect: function (selectedCategory) {
				modal.find('[name="cid"]').val(selectedCategory.cid);
			},
			cacheList: false,
			showLinks: true,
			template: 'admin/partials/category/selector-dropdown-right',
			localOnly: true,
		});
	});
}

function getStateClass(state) {
	switch (state) {
		case 'pending':
			return 'warning';
		case 'active':
			return 'success';
		case 'error':
			return 'danger';
		default:
			return 'secondary';
	}
}
