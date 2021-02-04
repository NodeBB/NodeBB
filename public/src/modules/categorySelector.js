'use strict';

define('categorySelector', ['categorySearch2'], function (categorySearch) {
	var categorySelector = {};

	categorySelector.init = function (el, options) {
		var onSelect = options.onSelect || function () {};

		options.states = options.states || ['watching', 'notwatching', 'ignoring'];

		$(window).trigger('action:category.selector.options', { el: el, options: options });

		categorySearch.init(el, {
			template: 'partials/category-selector',
			privilege: options.privilege,
			states: options.states,
		});

		var selector = {
			el: el,
			selectedCategory: null,
		};
		el.on('click', '[data-cid]', function () {
			var categoryEl = $(this);
			if (categoryEl.hasClass('disabled')) {
				return false;
			}
			selector.selectCategory(categoryEl.attr('data-cid'));
			onSelect(selector.selectedCategory);
		});

		selector.selectCategory = function (cid) {
			var categoryEl = selector.el.find('[data-cid="' + cid + '"]');
			selector.selectedCategory = {
				cid: cid,
				name: categoryEl.attr('data-name'),
			};

			if (categoryEl.length) {
				selector.el.find('[component="category-selector-selected"]').html(categoryEl.find('[component="category-markup"]').html());
			} else {
				selector.el.find('[component="category-selector-selected"]').translateHtml('[[topic:thread_tools.select_category]]');
			}
		};
		selector.getSelectedCategory = function () {
			return selector.selectedCategory;
		};
		selector.getSelectedCid = function () {
			return selector.selectedCategory ? selector.selectedCategory.cid : 0;
		};
		return selector;
	};

	categorySelector.modal = function (categories, callback) {
		if (typeof categories === 'function') {
			callback = categories;
			categories = ajaxify.data.allCategories;
		}
		app.parseAndTranslate('admin/partials/categories/select-category', {
			categories: categories,
		}, function (html) {
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
			var selector = categorySelector.init(modal.find('[component="category-selector"]'));
			function submit(ev) {
				ev.preventDefault();
				if (selector.selectedCategory) {
					callback(selector.selectedCategory.cid);
					modal.modal('hide');
				}
				return false;
			}

			modal.find('form').on('submit', submit);
		});
	};

	return categorySelector;
});
