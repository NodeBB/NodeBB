'use strict';

define('settings/sorted-list', [
	'benchpress',
	'bootbox',
	'hooks',
	'jquery-ui/widgets/sortable',
], function (benchpress, bootbox, hooks) {
	let Settings;


	const SortedList = {
		types: ['sorted-list'],
		use: function () {
			Settings = this;
		},
		set: function ($container, values) {
			const key = $container.attr('data-sorted-list');

			values[key] = [];
			$container.find('[data-type="item"]').each(function (idx, item) {
				const itemUUID = $(item).attr('data-sorted-list-uuid');

				const formData = Settings.helper.serializeForm($('[data-sorted-list-object="' + key + '"][data-sorted-list-uuid="' + itemUUID + '"]'));
				stripTags(formData);
				values[key].push(formData);
			});
		},
		get: async ($container, hash) => {
			const { listEl, key, formTpl, formValues } = await hooks.fire('filter:settings.sorted-list.load', {
				listEl: $container.find('[data-type="list"]'),
				key: $container.attr('data-sorted-list'),
				formTpl: $container.attr('data-form-template'),
				formValues: {},
			});

			const formHtml = await benchpress.render(formTpl, formValues);

			const addBtn = $('[data-sorted-list="' + key + '"] [data-type="add"]');

			addBtn.on('click', function () {
				const modal = bootbox.confirm(formHtml, function (save) {
					if (save) {
						SortedList.addItem(modal.find('form').children(), $container);
					}
				});
				hooks.fire('action:settings.sorted-list.modal', { modal });
			});

			const call = $container.parents('form').attr('data-socket-get');
			const list = ajaxify.data[call ? hash : 'settings'][key];

			if (Array.isArray(list) && typeof list[0] !== 'string') {
				const items = await Promise.all(list.map(async (item) => {
					({ item } = await hooks.fire('filter:settings.sorted-list.loadItem', { item }));

					const itemUUID = utils.generateUUID();
					const form = $(formHtml).deserialize(item);
					form.attr('data-sorted-list-uuid', itemUUID);
					form.attr('data-sorted-list-object', key);
					$('#content').append(form.hide());

					return { itemUUID, item };
				}));

				// todo: parse() needs to be refactored to return the html, so multiple calls can be parallelized
				for (const { itemUUID, item } of items) {
					// eslint-disable-next-line no-await-in-loop
					const element = await parse($container, itemUUID, item);
					hooks.fire('action:settings.sorted-list.itemLoaded', { element });
				}

				hooks.fire('action:settings.sorted-list.loaded', {
					containerEl: $container.get(0),
					listEl: listEl.get(0),
					hash,
					key,
				});
			}

			listEl.sortable().addClass('pointer');
		},
		addItem: async ($formElements, $target) => {
			const key = $target.attr('data-sorted-list');
			const itemUUID = utils.generateUUID();
			const form = $('<form class="" data-sorted-list-uuid="' + itemUUID + '" data-sorted-list-object="' + key + '"></form>');
			form.append($formElements);

			$('#content').append(form.hide());

			let data = Settings.helper.serializeForm(form);
			({ item: data } = await hooks.fire('filter:settings.sorted-list.loadItem', { item: data }));
			parse($target, itemUUID, data);
		},
	};

	function setupRemoveButton($container, itemUUID) {
		const removeBtn = $container.find('[data-sorted-list-uuid="' + itemUUID + '"] [data-type="remove"]');
		removeBtn.on('click', function () {
			$('[data-sorted-list-uuid="' + itemUUID + '"]').remove();
		});
	}

	function setupEditButton($container, itemUUID) {
		const $list = $container.find('[data-type="list"]');
		const key = $container.attr('data-sorted-list');
		const editBtn = $('[data-sorted-list-uuid="' + itemUUID + '"] [data-type="edit"]');

		editBtn.on('click', function () {
			const form = $('[data-sorted-list-uuid="' + itemUUID + '"][data-sorted-list-object="' + key + '"]');
			const clone = form.clone(true).show();

			// .clone() doesn't preserve the state of `select` elements, fixing after the fact
			clone.find('select').each((idx, el) => {
				el.value = form.find(`select#${el.id}`).val();
			});

			const modal = bootbox.confirm(clone, async (save) => {
				if (save) {
					const form = $('<form class="" data-sorted-list-uuid="' + itemUUID + '" data-sorted-list-object="' + key + '"></form>');
					form.append(modal.find('form').children());

					$('#content').find('[data-sorted-list-uuid="' + itemUUID + '"][data-sorted-list-object="' + key + '"]').remove();
					$('#content').append(form.hide());


					let data = Settings.helper.serializeForm(form);
					({ item: data } = await hooks.fire('filter:settings.sorted-list.loadItem', { item: data }));
					stripTags(data);

					const oldItem = $list.find('[data-sorted-list-uuid="' + itemUUID + '"]');
					parse($container, itemUUID, data, oldItem);
				}
			});
			hooks.fire('action:settings.sorted-list.modal', { modal });
		});
	}

	function parse($container, itemUUID, data, replaceEl) {
		// replaceEl is optional
		const $list = $container.find('[data-type="list"]');
		const itemTpl = $container.attr('data-item-template');

		stripTags(data);

		return new Promise((resolve) => {
			app.parseAndTranslate(itemTpl, data, function (itemHtml) {
				itemHtml = $(itemHtml);
				if (replaceEl) {
					replaceEl.replaceWith(itemHtml);
				} else {
					$list.append(itemHtml);
				}
				itemHtml.attr('data-sorted-list-uuid', itemUUID);

				setupRemoveButton($container, itemUUID);
				setupEditButton($container, itemUUID);
				hooks.fire('action:settings.sorted-list.parse', { itemHtml });
				resolve(itemHtml.get(0));
			});
		});
	}

	function stripTags(data) {
		return Object.entries(data || {}).forEach(([field, value]) => {
			data[field] = typeof value === 'string' ? utils.stripHTMLTags(value, utils.stripTags) : value;
		});
	}

	return SortedList;
});
