'use strict';

define('admin/settings/api', ['settings', 'clipboard', 'bootbox', 'benchpress', 'api', 'alerts'], function (settings, clipboard, bootbox, Benchpress, api, alerts) {
	const ACP = {};

	ACP.init = function () {
		settings.load('core.api', $('.core-api-settings'));
		$('#save').on('click', () => {
			settings.save('core.api', $('.core-api-settings'));
		});

		// Click to copy
		const copyEls = document.querySelectorAll('[data-component="acp/tokens"] [data-action="copy"]');
		new clipboard(copyEls);

		$('[data-action="create"]').on('click', handleTokenCreation);

		handleActions();
	};

	function handleActions() {
		const formEl = document.querySelector('#content form');
		if (!formEl) {
			return;
		}

		formEl.addEventListener('click', (e) => {
			const subselector = e.target.closest('[data-action]');
			if (subselector) {
				const action = subselector.getAttribute('data-action');

				switch (action) {
					case 'edit':
						handleTokenUpdate(subselector);
						break;

					case 'delete':
						handleTokenDeletion(subselector);
						break;

					case 'roll':
						handleTokenRolling(subselector);
						break;
				}
			}
		});
	}

	async function handleTokenCreation() {
		const html = await Benchpress.render('admin/partials/edit-token-modal', {});
		const parseForm = async function () {
			const modal = this;
			const formEl = this.get(0).querySelector('form');
			const tokensTableBody = document.querySelector('[data-component="acp/tokens"] tbody');
			const valid = formEl.reportValidity();
			if (formEl && valid) {
				const formData = new FormData(formEl);
				const uid = formData.get('uid');
				const description = formData.get('description');

				try {
					const tokenObj = await api.post('/admin/tokens', { uid, description });
					if (!tokensTableBody) {
						modal.modal('hide');
						return ajaxify.refresh();
					}

					ajaxify.data.tokens.push(tokenObj);
					const rowEl = (await app.parseAndTranslate(ajaxify.data.template.name, 'tokens', {
						tokens: [tokenObj],
					})).get(0);

					tokensTableBody.append(rowEl);
					$(rowEl).find('.timeago').timeago();
					modal.modal('hide');
				} catch (e) {
					alerts.error(e);
				}
			}

			return false;
		};

		bootbox.dialog({
			title: '[[admin/settings/api:create-token]]',
			message: html,
			buttons: {
				submit: {
					label: '[[modules:bootbox.submit]]',
					className: 'btn-primary',
					callback: parseForm,
				},
			},
		});
	}

	async function handleTokenUpdate(el) {
		const rowEl = el.closest('[data-token]');
		const token = rowEl.getAttribute('data-token');
		const { uid, description } = await api.get(`/admin/tokens/${token}`);
		const parseForm = async function () {
			const modal = this;
			const formEl = this.get(0).querySelector('form');
			const valid = formEl.reportValidity();
			if (formEl && valid) {
				const formData = new FormData(formEl);
				const uid = formData.get('uid');
				const description = formData.get('description');

				try {
					const tokenObj = await api.put(`/admin/tokens/${token}`, { uid, description });
					const newEl = (await app.parseAndTranslate(ajaxify.data.template.name, 'tokens', {
						tokens: [tokenObj],
					})).get(0);

					rowEl.replaceWith(newEl);
					$(newEl).find('.timeago').timeago();
					modal.modal('hide');
				} catch (e) {
					alerts.error(e);
				}
			}

			return false;
		};

		const html = await Benchpress.render('admin/partials/edit-token-modal', { uid, description });
		bootbox.dialog({
			title: '[[admin/settings/api:update-token]]',
			message: html,
			buttons: {
				submit: {
					label: '[[modules:bootbox.submit]]',
					className: 'btn-primary',
					callback: parseForm,
				},
			},
		});
	}

	async function handleTokenDeletion(el) {
		const rowEl = el.closest('[data-token]');
		const token = rowEl.getAttribute('data-token');

		bootbox.confirm('[[admin/settings/api:delete-confirm]]', async (ok) => {
			if (ok) {
				try {
					await api.del(`/admin/tokens/${token}`);
				} catch (e) {
					alerts.error(e);
				}

				rowEl.remove();
			}
		});
	}

	async function handleTokenRolling(el) {
		const rowEl = el.closest('[data-token]');
		const token = rowEl.getAttribute('data-token');

		bootbox.confirm('[[admin/settings/api:roll-confirm]]', async (ok) => {
			if (ok) {
				try {
					const tokenObj = await api.post(`/admin/tokens/${token}/roll`);
					const newEl = (await app.parseAndTranslate(ajaxify.data.template.name, 'tokens', {
						tokens: [tokenObj],
					})).get(0);

					rowEl.replaceWith(newEl);
					$(newEl).find('.timeago').timeago();
				} catch (e) {
					alerts.error(e);
				}
			}
		});
	}

	return ACP;
});
