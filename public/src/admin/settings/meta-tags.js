'use strict';

define('admin/settings/meta-tags', ['settings', 'translator', 'hooks'], function (settings, translator, hooks) {
	const MetaTags = {};

	MetaTags.init = function () {
		const formEl = $('.meta-tags-settings');

		settings.load('metaTags', formEl);

		$('#add-meta-tag').on('click', addRow);
		formEl.on('click', '[data-action="remove-tag"]', function () {
			$(this).closest('[data-type="meta-tag-row"]').remove();
		});
		// Keep the content input's `name` in sync with the key so serializeObject
		// produces a flat { key: content } hash
		formEl.on('input', '.meta-tag-key', function () {
			$(this).closest('[data-type="meta-tag-row"]').find('.meta-tag-content').attr('name', $(this).val());
		});

		// `#save` is bound by Settings.prepare() (settings v1) on action:ajaxify.end,
		// which runs after this module's init(). Rebind it here — registered later on the
		// same hook, so it runs after prepare() and wins — to save the settings v2 form.
		hooks.on('action:ajaxify.end', function () {
			const el = $('.meta-tags-settings');
			if (!el.length) {
				return;
			}
			$('#save').off('click').on('click', function () {
				settings.save('metaTags', el);
				return false;
			});
		});
	};

	async function addRow() {
		const removeTitle = await translator.translate('admin/settings/meta-tags:remove');

		const row = $(
			'<div class="meta-tag-row d-flex gap-2 mb-2" data-type="meta-tag-row">' +
			'<input type="text" class="form-control meta-tag-key" style="flex: 0 0 200px;" placeholder="og:title" />' +
			'<input type="text" class="form-control meta-tag-content" style="flex: 1;" placeholder="My Site" />' +
			'<button type="button" class="btn btn-sm btn-outline-danger" data-action="remove-tag" title="' + removeTitle + '"><i class="fa fa-times"></i></button>' +
			'</div>'
		);

		$('#meta-tags-list').append(row);
	}

	return MetaTags;
});
