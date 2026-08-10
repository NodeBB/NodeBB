'use strict';

define('admin/manage/api', [
	'settings', 'clipboard', 'modals', 'benchpress', 'api', 'alerts', 'utils', 'helpers',
], function (settings, clipboard, modals, Benchpress, api, alerts, utils, helpers) {
	const ACP = {};

	ACP.init = function () {
		settings.load('core.api', $('.core-api-settings'));
		$('#save').on('click', () => {
			settings.save('core.api', $('.core-api-settings'));
		});

		$('[data-action="create"]').on('click', handleTokenCreation);

		handleActions();
	};

	function normalizeTokenForTable(tokenObj) {
		const tokenValue = tokenObj.secret || tokenObj.token || '';
		return {
			...tokenObj,
			tokenId: tokenObj.tokenId || tokenObj.token,
			tokenMasked: tokenObj.tokenMasked || utils.maskToken(tokenValue),
		};
	}

	async function revealTokenOnce(token) {
		if (!token) {
			return;
		}

		const modal = await modals.dialog({
			title: '[[admin/settings/api:token-once-title]]',
			message: `
				<p class="text-danger fw-semibold mb-2">[[admin/settings/api:token-once-warning]]</p>
				<div class="input-group">
					<input type="text" class="form-control user-select-all" readonly data-component="token-secret" value="${helpers.escape(token)}" />
					<button type="button" class="btn btn-ghost border" data-action="copy" data-clipboard-text="${helpers.escape(token)}">[[admin/settings/api:copy-token]]</button>
				</div>
			`,
			buttons: {
				ok: {
					label: '[[modules:bootbox.ok]]',
					className: 'btn-primary',
				},
			},
		});
		modal.on('shown.bs.modal', () => {
			const clip = new clipboard(modal.find('[data-action="copy"]').get(0), {
				container: modal.get(0),
			});
			clip.on('success', () => {
				alerts.success('[[admin/settings/api:token-copied]]');
			});
			clip.on('error', () => {
				alerts.error('[[admin/settings/api:token-copy-failed]]');
			});
		});
	}

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
				const isMasterToken = parseInt(uid, 10) === 0;

				try {
					let password;
					if (isMasterToken) {
						password = await modals.promptPassword();
						if (!password) {
							return false;
						}
					}

					const tokenObj = await api.post('/admin/tokens', {
						uid,
						description,
						...(isMasterToken ? { password } : {}),
					});
					const secret = tokenObj.secret;
					const tableObj = normalizeTokenForTable(tokenObj);
					delete tableObj.token;
					delete tableObj.secret;
					if (!tokensTableBody) {
						modal.modal('hide');
						await revealTokenOnce(secret);
						return ajaxify.refresh();
					}

					ajaxify.data.tokens.push(tableObj);
					const rowEl = (await app.parseAndTranslate(ajaxify.data.template.name, 'tokens', {
						tokens: [tableObj],
					})).get(0);

					tokensTableBody.append(rowEl);
					$(rowEl).find('.timeago').timeago();
					modal.modal('hide');
					await revealTokenOnce(secret);
				} catch (e) {
					alerts.error(e);
				}
			}

			return false;
		};

		modals.dialog({
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
					const tableObj = normalizeTokenForTable(tokenObj);
					delete tableObj.token;
					delete tableObj.secret;
					const newEl = (await app.parseAndTranslate(ajaxify.data.template.name, 'tokens', {
						tokens: [tableObj],
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
		modals.dialog({
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

		modals.confirm('[[admin/settings/api:delete-confirm]]', async (ok) => {
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

		modals.confirm('[[admin/settings/api:roll-confirm]]', async (ok) => {
			if (ok) {
				try {
					const tokenObj = await api.post(`/admin/tokens/${token}/roll`);
					const secret = tokenObj.secret;
					const tableObj = normalizeTokenForTable(tokenObj);
					delete tableObj.token;
					delete tableObj.secret;
					const newEl = (await app.parseAndTranslate(ajaxify.data.template.name, 'tokens', {
						tokens: [tableObj],
					})).get(0);

					rowEl.replaceWith(newEl);
					$(newEl).find('.timeago').timeago();
					await revealTokenOnce(secret);
				} catch (e) {
					alerts.error(e);
				}
			}
		});
	}

	return ACP;
});
