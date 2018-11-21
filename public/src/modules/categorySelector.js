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

		var searchEl = el.find('[component="category-selector-search"]');
		var categoryEls = el.find('.category-dropdown-menu .category');
		el.on('show.bs.dropdown', function () {
			function updateList() {
				var val = searchEl.find('input').val().toLowerCase();
				categoryEls.each(function () {
					var liEl = $(this);
					liEl.toggleClass('hidden', liEl.attr('data-name').toLowerCase().indexOf(val) === -1);
				});
			}

			searchEl.removeClass('hidden').on('click', function (ev) {
				ev.preventDefault();
				ev.stopPropagation();
			});
			searchEl.find('input').val('').on('keyup', updateList);
			updateList();
		});

		el.on('hide.bs.dropdown', function () {
			searchEl.addClass('hidden').off('click');
			searchEl.find('input').off('keyup');
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
