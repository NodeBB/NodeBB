'use strict';

define('admin/manage/oauth', [
	'clipboard', 'modals', 'api', 'alerts', 'helpers',
], function (clipboard, modals, api, alerts, helpers) {
	const ACP = {};

	ACP.init = function () {
		$('[data-action="create"]').on('click', () => showClientModal());
		$('[data-component="acp/oauth-clients"]').on('click', '[data-action]', (e) => {
			const el = e.target.closest('[data-action]');
			if (!el) {
				return;
			}
			const action = el.getAttribute('data-action');
			if (action === 'edit') {
				showClientModal(el);
			} else if (action === 'rotate-secret') {
				rotateSecret(el);
			} else if (action === 'delete') {
				deleteClient(el);
			}
		});
	};

	function buildModalHtml(client = {}) {
		const grants = ajaxify.data.grants || [];
		const scopes = (ajaxify.data.scopes || []).map(s => s.name);
		const selectedGrants = client.grants || ['authorization_code', 'refresh_token'];
		const selectedScopes = client.scopes || [];
		const redirectUris = (client.redirectUris || []).join('\n');

		return `
			<form class="d-flex flex-column gap-3">
				<div>
					<label class="form-label" for="client-name">{{tx("admin/manage/oauth:name")}}</label>
					<input type="text" class="form-control" id="client-name" name="name" value="${helpers.escape(client.name || '')}" required />
				</div>
				<div>
					<label class="form-label" for="client-description">{{tx("admin/manage/oauth:description")}}</label>
					<input type="text" class="form-control" id="client-description" name="description" value="${helpers.escape(client.description || '')}" />
				</div>
				<div>
					<label class="form-label" for="client-redirect-uris">{{tx("admin/manage/oauth:redirect-uris")}}</label>
					<textarea class="form-control" id="client-redirect-uris" name="redirectUris" rows="3" placeholder="https://example.com/callback" required>${helpers.escape(redirectUris)}</textarea>
					<div class="form-text">{{tx("admin/manage/oauth:redirect-uris-help")}}</div>
				</div>
				<div>
					<label class="form-label d-block">{{tx("admin/manage/oauth:grants")}}</label>
					${grants.map(g => `
						<div class="form-check">
							<input type="checkbox" class="form-check-input" name="grants" id="grant-${g}" value="${g}" ${selectedGrants.includes(g) ? 'checked' : ''} />
							<label class="form-check-label" for="grant-${g}">${g}</label>
						</div>
					`).join('')}
				</div>
				<div>
					<label class="form-label d-block">{{tx("admin/manage/oauth:scopes")}}</label>
					${scopes.map(s => `
						<div class="form-check">
							<input type="checkbox" class="form-check-input" name="scopes" id="scope-${s}" value="${s}" ${selectedScopes.includes(s) ? 'checked' : ''} />
							<label class="form-check-label" for="scope-${s}">${s}</label>
						</div>
					`).join('')}
				</div>
				<div class="form-check">
					<input type="checkbox" class="form-check-input" id="client-public" name="public" ${client.public ? 'checked' : ''} />
					<label class="form-check-label" for="client-public">{{tx("admin/manage/oauth:public")}}</label>
					<div class="form-text">{{tx("admin/manage/oauth:public-help")}}</div>
				</div>
				<div class="form-check">
					<input type="checkbox" class="form-check-input" id="client-disabled" name="disabled" ${client.disabled ? 'checked' : ''} />
					<label class="form-check-label" for="client-disabled">{{tx("admin/manage/oauth:disabled")}}</label>
				</div>
			</form>
		`;
	}

	function parseForm(formEl) {
		const formData = new FormData(formEl);
		return {
			name: formData.get('name'),
			description: formData.get('description'),
			redirectUris: formData.get('redirectUris').split('\n').map(s => s.trim()).filter(Boolean),
			grants: formData.getAll('grants'),
			scopes: formData.getAll('scopes'),
			public: formData.get('public') === 'on',
			disabled: formData.get('disabled') === 'on',
		};
	}

	async function showClientModal(editEl) {
		const rowEl = editEl ? editEl.closest('[data-client-id]') : null;
		const clientId = rowEl ? rowEl.getAttribute('data-client-id') : null;

		let client = {};
		if (clientId) {
			const { client: fetched } = await api.get(`/admin/oauth/clients/${clientId}`);
			client = fetched;
		}

		const parseFormCallback = async function () {
			const modal = this;
			const formEl = this.get(0).querySelector('form');
			if (!formEl.reportValidity()) {
				return false;
			}

			try {
				let result;
				if (clientId) {
					result = await api.put(`/admin/oauth/clients/${clientId}`, parseForm(formEl));
				} else {
					result = await api.post('/admin/oauth/clients', parseForm(formEl));
				}
				modal.modal('hide');
				if (clientId) {
					await ajaxify.refresh();
				} else {
					if (!result.client.public && result.secret) {
						await revealSecretOnce(result.secret);
					}
					await ajaxify.refresh();
				}
			} catch (e) {
				alerts.error(e);
			}
			return false;
		};

		modals.dialog({
			title: clientId ? '[[admin/manage/oauth:update-client]]' : '[[admin/manage/oauth:create-client]]',
			message: buildModalHtml(client),
			size: 'large',
			buttons: {
				submit: {
					label: '[[modules:bootbox.submit]]',
					className: 'btn-primary',
					callback: parseFormCallback,
				},
			},
		});
	}

	async function rotateSecret(el) {
		const rowEl = el.closest('[data-client-id]');
		const clientId = rowEl.getAttribute('data-client-id');
		try {
			const { secret } = await api.post(`/admin/oauth/clients/${clientId}/secret`);
			await revealSecretOnce(secret);
			alerts.success('[[admin/manage/oauth:secret-rotated]]');
		} catch (e) {
			alerts.error(e);
		}
	}

	async function deleteClient(el) {
		const rowEl = el.closest('[data-client-id]');
		const clientId = rowEl.getAttribute('data-client-id');
		modals.confirm('[[admin/manage/oauth:delete-confirm]]', async (confirm) => {
			if (!confirm) {
				return;
			}
			try {
				await api.delete(`/admin/oauth/clients/${clientId}`);
				await ajaxify.refresh();
			} catch (e) {
				alerts.error(e);
			}
		});
	}

	async function revealSecretOnce(secret) {
		const modal = await modals.dialog({
			title: '[[admin/manage/oauth:secret-once-title]]',
			message: `
				<p class="text-danger fw-semibold mb-2">[[admin/manage/oauth:secret-once-warning]]</p>
				<div class="input-group">
					<input type="text" class="form-control user-select-all" readonly value="${helpers.escape(secret)}" />
					<button type="button" class="btn btn-ghost border" data-action="copy" data-clipboard-text="${helpers.escape(secret)}">[[admin/manage/oauth:copy-secret]]</button>
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
				alerts.success('[[admin/manage/oauth:secret-copied]]');
			});
			clip.on('error', () => {
				alerts.error('[[admin/manage/oauth:secret-copy-failed]]');
			});
		});
	}

	return ACP;
});
