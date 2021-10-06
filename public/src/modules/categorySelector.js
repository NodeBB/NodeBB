'use strict';

define('categorySelector', [
	'categorySearch', 'bootbox', 'hooks',
], function (categorySearch, bootbox, hooks) {
	var categorySelector = {};

	categorySelector.init = function (el, options) {
		if (!el || !el.length) {
			return;
		}
		options = options || {};
		var onSelect = options.onSelect || function () {};

		options.states = options.states || ['watching', 'notwatching', 'ignoring'];
		options.template = 'partials/category-selector';
		hooks.fire('action:category.selector.options', { el: el, options: options });

		categorySearch.init(el, options);

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
		const defaultSelectHtml = selector.el.find('[component="category-selector-selected"]').html();
		selector.selectCategory = function (cid) {
			var categoryEl = selector.el.find('[data-cid="' + cid + '"]');
			selector.selectedCategory = {
				cid: cid,
				name: categoryEl.attr('data-name'),
			};

			if (categoryEl.length) {
				selector.el.find('[component="category-selector-selected"]').html(
					categoryEl.find('[component="category-markup"]').html()
				);
			} else {
				selector.el.find('[component="category-selector-selected"]').html(
					defaultSelectHtml
				);
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

	categorySelector.modal = function (options) {
		options = options || {};
		options.onSelect = options.onSelect || function () {};
		options.onSubmit = options.onSubmit || function () {};
		app.parseAndTranslate('admin/partials/categories/select-category', { message: options.message }, function (html) {
			var modal = bootbox.dialog({
				title: options.title || '[[modules:composer.select_category]]',
				message: html,
				buttons: {
					save: {
						label: '[[global:select]]',
						className: 'btn-primary',
						callback: submit,
					},
				},
			});

			var selector = categorySelector.init(modal.find('[component="category-selector"]'), options);
			function submit(ev) {
				ev.preventDefault();
				if (selector.selectedCategory) {
					options.onSubmit(selector.selectedCategory);
					modal.modal('hide');
				}
				return false;
			}
			if (options.openOnLoad) {
				modal.on('shown.bs.modal', function () {
					modal.find('.dropdown-toggle').dropdown('toggle');
				});
			}
			modal.find('form').on('submit', submit);
		});
	};

	return categorySelector;
});
