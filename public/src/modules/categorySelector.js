'use strict';

define('categorySelector', [
	'categorySearch', 'bootbox', 'hooks', 'translator',
], function (categorySearch, bootbox, hooks, translator) {
	const categorySelector = {};

	categorySelector.init = function (el, options) {
		if (!el || !el.length) {
			return;
		}
		options = options || {};
		const onSelect = options.onSelect || function () {};

		options.states = options.states || ['watching', 'tracking', 'notwatching', 'ignoring'];
		options.template = options.template || 'partials/category/selector-dropdown-left';
		hooks.fire('action:category.selector.options', { el: el, options: options });

		categorySearch.init(el, options);

		const selector = {
			el: el,
			selectedCategory: null,
		};

		el.on('click', '[data-cid]', function () {
			const categoryEl = $(this);
			if (categoryEl.hasClass('disabled')) {
				return false;
			}
			selector.selectCategory(categoryEl.attr('data-cid'));
			return onSelect(selector.selectedCategory);
		});

		let defaultSelectHtml = selector.el.find('[component="category-selector-selected"]').html();

		translator.translate(defaultSelectHtml, (translated) => {
			defaultSelectHtml = translated;
		});
		selector.selectCategory = function (cid) {
			const categoryEl = selector.el.find('[data-cid="' + cid + '"]');
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

		if (options.hasOwnProperty('selectedCategory')) {
			app.parseAndTranslate(options.template, { selectedCategory: options.selectedCategory }, function (html) {
				selector.el.find('[component="category-selector-selected"]').html(
					html.find('[component="category-selector-selected"]').html()
				);
			});
		}
		return selector;
	};

	categorySelector.modal = function (options) {
		options = options || {};
		options.onSelect = options.onSelect || function () {};
		options.onSubmit = options.onSubmit || function () {};
		app.parseAndTranslate('admin/partials/categories/select-category', { message: options.message }, function (html) {
			const modal = bootbox.dialog({
				title: options.title || '[[modules:composer.select-category]]',
				message: html,
				buttons: {
					save: {
						label: '[[global:select]]',
						className: 'btn-primary',
						callback: submit,
					},
				},
			});

			const selector = categorySelector.init(modal.find('[component="category-selector"]'), options);
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
