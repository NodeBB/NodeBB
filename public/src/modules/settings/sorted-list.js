'use strict';

define('settings/sorted-list', [
	'benchpress',
	'jquery-ui/widgets/sortable',
], function (benchpress) {
	var SortedList;
	var Settings;


	SortedList = {
		types: ['sorted-list'],
		use: function () {
			Settings = this;
		},
		set: function ($container, values) {
			var key = $container.attr('data-sorted-list');

			values[key] = [];
			$container.find('[data-type="item"]').each(function (idx, item) {
				var itemUUID = $(item).attr('data-sorted-list-uuid');

				var formData = $('[data-sorted-list-object="' + key + '"][data-sorted-list-uuid="' + itemUUID + '"]');
				values[key].push(Settings.helper.serializeForm(formData));
			});
		},
		get: function ($container) {
			var $list = $container.find('[data-type="list"]');
			var key = $container.attr('data-sorted-list');
			var formTpl = $container.attr('data-form-template');

			benchpress.render(formTpl, {}).then(function (formHtml) {
				var addBtn = $('[data-sorted-list="' + key + '"] [data-type="add"]');

				addBtn.on('click', function () {
					var modal = bootbox.confirm(formHtml, function (save) {
						if (save) {
							var itemUUID = utils.generateUUID();
							var form = $('<form class="" data-sorted-list-uuid="' + itemUUID + '" data-sorted-list-object="' + key + '"></form>');
							form.append(modal.find('form').children());

							$('#content').append(form.hide());


							var data = Settings.helper.serializeForm(form);
							parse($container, itemUUID, data);
						}
					});
				});

				var list = ajaxify.data.settings[key];
				if (Array.isArray(list) && typeof list[0] !== 'string') {
					list.forEach(function (item) {
						var itemUUID = utils.generateUUID();
						var form = $(formHtml).deserialize(item);
						form.attr('data-sorted-list-uuid', itemUUID);
						form.attr('data-sorted-list-object', key);
						$('#content').append(form.hide());

						parse($container, itemUUID, item);
					});
				}
			});

			$list.sortable().addClass('pointer');
			$(window).trigger('action:settings.sorted-list.loaded', { element: $list.get(0) });
		},
	};

	function setupRemoveButton($container, itemUUID) {
		var removeBtn = $container.find('[data-sorted-list-uuid="' + itemUUID + '"] [data-type="remove"]');
		removeBtn.on('click', function () {
			console.log(itemUUID);
			$('[data-sorted-list-uuid="' + itemUUID + '"]').remove();
		});
	}

	function setupEditButton($container, itemUUID) {
		var $list = $container.find('[data-type="list"]');
		var key = $container.attr('data-sorted-list');
		var itemTpl = $container.attr('data-item-template');
		var editBtn = $('[data-sorted-list-uuid="' + itemUUID + '"] [data-type="edit"]');

		editBtn.on('click', function () {
			var form = $('[data-sorted-list-uuid="' + itemUUID + '"][data-sorted-list-object="' + key + '"]').clone(true).show();

			var modal = bootbox.confirm(form, function (save) {
				if (save) {
					var form = $('<form class="" data-sorted-list-uuid="' + itemUUID + '" data-sorted-list-object="' + key + '"></form>');
					form.append(modal.find('form').children());

					$('#content').find('[data-sorted-list-uuid="' + itemUUID + '"][data-sorted-list-object="' + key + '"]').remove();
					$('#content').append(form.hide());


					var data = Settings.helper.serializeForm(form);

					app.parseAndTranslate(itemTpl, data, function (itemHtml) {
						itemHtml = $(itemHtml);
						var oldItem = $list.find('[data-sorted-list-uuid="' + itemUUID + '"]');
						oldItem.after(itemHtml);
						oldItem.remove();
						itemHtml.attr('data-sorted-list-uuid', itemUUID);

						setupRemoveButton($container, itemUUID);
						setupEditButton($container, itemUUID);
					});
				}
			});
		});
	}

	function parse($container, itemUUID, data) {
		var $list = $container.find('[data-type="list"]');
		var itemTpl = $container.attr('data-item-template');

		app.parseAndTranslate(itemTpl, data, function (itemHtml) {
			itemHtml = $(itemHtml);
			$list.append(itemHtml);
			itemHtml.attr('data-sorted-list-uuid', itemUUID);

			setupRemoveButton($container, itemUUID);
			setupEditButton($container, itemUUID);
		});
	}

	return SortedList;
});
