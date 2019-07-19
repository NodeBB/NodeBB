'use strict';

/* global bootbox, utils */

define('settings/sorted-list', ['benchpress', 'jqueryui'], function (benchpress) {
	var SortedList;
	var Settings;


	SortedList = {
		types: ['sorted-list'],
		use: function () {
			Settings = this;
		},
		set: function ($element, values) {
			var key = $element.attr('data-sorted-list');

			values[key] = [];
			$('[data-sorted-list-item="' + key + '"]').each(function (idx, item) {
				var itemUUID = $(item).attr('data-sorted-list-uuid');

				var formData = $('[data-sorted-list-object="' + key + '"][data-sorted-list-uuid="' + itemUUID + '"]');
				values[key].push(Settings.helper.serializeForm(formData));
			});
		},
		get: function ($element) {
			var key = $element.attr('data-sorted-list');
			var itemTpl = $element.attr('data-item-template');
			var formTpl = $element.attr('data-form-template');

			function setupRemoveButton() {
				var removeBtn = $('[data-sorted-list-action="' + key + '"][data-sorted-list-action-type="remove"]');
				removeBtn.on('click', function () {
					var itemUUID = $(this).parents('[data-sorted-list-uuid]').attr('data-sorted-list-uuid');
					$('[data-sorted-list-uuid="' + itemUUID + '"]').remove();
				});
			}

			function setupEditButton() {
				var editBtn = $('[data-sorted-list-action="' + key + '"][data-sorted-list-action-type="edit"]');
				editBtn.on('click', function () {
					var itemUUID = $(this).parents('[data-sorted-list-uuid]').attr('data-sorted-list-uuid');
					var form = $('[data-sorted-list-uuid="' + itemUUID + '"][data-sorted-list-object="' + key + '"]');
					var modal = bootbox.confirm(form, function (save) {
						if (save) {
							var itemUUID = utils.generateUUID();
							var form = $('<form class="" data-sorted-list-uuid="' + itemUUID + '" data-sorted-list-object="' + key + '" />');
							form.append(modal.find('form').children());

							$('#content').append(form.hide());


							var data = Settings.helper.serializeForm(form);

							benchpress.parse(itemTpl, data, function (itemHtml) {
								itemHtml = $(itemHtml);
								$element.append(itemHtml);
								itemHtml.attr('data-sorted-list-uuid', itemUUID);

								setupRemoveButton();
								setupEditButton();
							});
						}
					});
				});
			}

			benchpress.parse(formTpl, {}, function (formHtml) {
				var addBtn = $('[data-sorted-list-action="' + key + '"][data-sorted-list-action-type="add"]');

				addBtn.on('click', function () {
					var modal = bootbox.confirm(formHtml, function (save) {
						if (save) {
							var itemUUID = utils.generateUUID();
							var form = $('<form class="" data-sorted-list-uuid="' + itemUUID + '" data-sorted-list-object="' + key + '" />');
							form.append(modal.find('form').children());

							$('#content').append(form.hide());


							var data = Settings.helper.serializeForm(form);

							benchpress.parse(itemTpl, data, function (itemHtml) {
								itemHtml = $(itemHtml);
								$element.append(itemHtml);
								itemHtml.attr('data-sorted-list-uuid', itemUUID);

								setupRemoveButton();
								setupEditButton();
							});
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

						benchpress.parse(itemTpl, item, function (itemHtml) {
							itemHtml = $(itemHtml);
							$element.append(itemHtml);
							itemHtml.attr('data-sorted-list-uuid', itemUUID);

							setupRemoveButton();
							setupEditButton();
						});
					});
				}
			});

			$element.sortable();
		},
	};

	return SortedList;
});
