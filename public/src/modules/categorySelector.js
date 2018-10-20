'use strict';

define('categorySelector', ['benchpress', 'translator'], function (Benchpress, translator) {
	var categorySelector = {};
	var selectedCategory;
	var el;
	categorySelector.init = function (_el, callback) {
		callback = callback || function () {};
		el = _el;
		selectedCategory = null;
		el.on('click', '[data-cid]', function () {
			var categoryEl = $(this);
			categorySelector.selectCategory(categoryEl.attr('data-cid'));
			callback(selectedCategory);
		});
	};

	categorySelector.getSelectedCategory = function () {
		return selectedCategory;
	};

	categorySelector.selectCategory = function (cid) {
		var categoryEl = el.find('[data-cid="' + cid + '"]');
		selectedCategory = {
			cid: cid,
			name: categoryEl.attr('data-name'),
		};
		el.find('[component="category-selector-selected"]').html(categoryEl.find('[component="category-markup"]').html());
	};

	categorySelector.modal = function (categories, callback) {
		if (typeof categories === 'function') {
			callback = categories;
			categories = ajaxify.data.allCategories;
		}
		Benchpress.parse('admin/partials/categories/select-category', {
			categories: categories,
		}, function (html) {
			translator.translate(html, function (html) {
				var modal = bootbox.dialog({
					title: '[[modules:composer.select_category]]',
					message: html,
					buttons: {
						save: {
							label: '[[global:select]]',
							className: 'btn-primary',
							callback: submit,
						},
					},
				});
				categorySelector.init(modal.find('[component="category-selector"]'));
				function submit(ev) {
					ev.preventDefault();
					var selectedCategory = categorySelector.getSelectedCategory();
					if (selectedCategory) {
						callback(selectedCategory.cid);
						modal.modal('hide');
					}
					return false;
				}

				modal.find('form').on('submit', submit);
			});
		});
	};

	return categorySelector;
});

