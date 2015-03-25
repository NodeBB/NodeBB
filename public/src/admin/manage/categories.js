"use strict";
/*global define, socket, app, bootbox, templates, ajaxify, RELATIVE_PATH*/

define('admin/manage/categories', function() {
	var	Categories = {};

	Categories.init = function() {
		var bothEl = $('#active-categories, #disabled-categories');

		function updateCategoryOrders(evt, ui) {
			var categories = $(evt.target).children(),
				modified = {},
				cid;

			for(var i=0;i<categories.length;i++) {
				cid = $(categories[i]).attr('data-cid');
				modified[cid] = {
					order: i+1
				};
			}

			socket.emit('admin.categories.update', modified);
		}

		bothEl.sortable({
			stop: updateCategoryOrders,
			distance: 15
		});

		// Category enable/disable
		bothEl.on('click', '[data-action="toggle"]', function(ev) {
			var btnEl = $(this),
				cid = btnEl.parents('tr').attr('data-cid'),
				disabled = btnEl.attr('data-disabled') === 'false' ? '1' : '0',
				payload = {};

			payload[cid] = {
				disabled: disabled
			};

			socket.emit('admin.categories.update', payload, function(err, result) {
				if (err) {
					return app.alertError(err.message);
				} else {
					ajaxify.refresh();
				}
			});
		});

		function showCreateCategoryModal() {
			$('#new-category-modal').modal();
		}

		function createNewCategory() {
			var category = {
				name: $('#inputName').val(),
				description: $('#inputDescription').val(),
				icon: $('#new-category-modal i').attr('value'),
				order: $('#active-categories').children().length + 1
			};

			saveNew(category);
		}

		function saveNew(category) {
			socket.emit('admin.categories.create', category, function(err, data) {
				if(err) {
					return app.alertError(err.message);
				}

				app.alert({
					alert_id: 'category_created',
					title: 'Created',
					message: 'Category successfully created!',
					type: 'success',
					timeout: 2000
				});

				$('#new-category-modal').modal('hide');
				ajaxify.refresh();
			});
		}

		$('#addNew').on('click', showCreateCategoryModal);
		$('#create-category-btn').on('click', createNewCategory);
	};

	return Categories;
});