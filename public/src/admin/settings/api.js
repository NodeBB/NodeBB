'use strict';

define('admin/settings/api', ['settings', 'clipboard', 'bootbox', 'benchpress', 'api'], function (settings, clipboard, bootbox, Benchpress, api) {
	const ACP = {};

	ACP.init = function () {
		settings.load('core.api', $('.core-api-settings'));
		$('#save').on('click', () => {
			settings.save('core.api', $('.core-api-settings'));
		});

		// Click to copy
		const copyEls = document.querySelectorAll('[data-component="acp/tokens"] [data-action="copy"]');
		new clipboard(copyEls);

		handleTokenCreation();
	};

	async function handleTokenCreation() {
		const createEl = document.querySelector('[data-action="create"]');
		if (createEl) {
			createEl.addEventListener('click', async () => {
				const html = await Benchpress.render('admin/partials/edit-token-modal', {});
				bootbox.dialog({
					title: '[[admin/settings/api:create-token]]',
					message: html,
					buttons: {
						submit: {
							label: '[[modules:bootbox.submit]]',
							className: 'btn-primary',
							callback: parseCreateForm,
						},
					},
				});
			});
		}
	}

	async function parseCreateForm() {
		const modal = this;
		const formEl = this.get(0).querySelector('form');
		const tokensTableBody = document.querySelector('[data-component="acp/tokens"] tbody');
		const valid = formEl.reportValidity();
		if (formEl && valid) {
			const formData = new FormData(formEl);
			const uid = formData.get('uid');
			const description = formData.get('description');
			// const qs = new URLSearchParams(payload).toString();

			const token = await api.post('/admin/tokens', { uid, description }).catch(app.alertError);

			const now = new Date();
			const rowEl = (await app.parseAndTranslate(ajaxify.data.template.name, 'tokens', {
				tokens: [{
					token,
					uid,
					description,
					timestamp: now.getTime(),
					timestampISO: now.toISOString(),
					lastSeen: null,
					lastSeenISO: new Date(0).toISOString(),
				}],
			})).get(0);

			if (tokensTableBody) {
				tokensTableBody.append(rowEl);
				$(rowEl).find('.timeago').timeago();
			} else {
				ajaxify.refresh();
			}

			modal.modal('hide');
		}

		return false;
	}

	return ACP;
});
