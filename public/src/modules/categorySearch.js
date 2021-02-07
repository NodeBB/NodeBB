'use strict';

define('categorySearch', function () {
	var categorySearch = {};

	categorySearch.init = function (el, options) {
		var categoriesList = null;
		options = options || {};
		options.privilege = options.privilege || 'topics:read';
		options.states = options.states || ['watching', 'notwatching', 'ignoring'];

		var localCategories = [];
		if (Array.isArray(options.localCategories)) {
			localCategories = options.localCategories.map(c => ({ ...c }));
		}
		options.selectedCids = options.selectedCids || ajaxify.data.selectedCids || [];

		var searchEl = el.find('[component="category-selector-search"]');
		if (!searchEl.length) {
			return;
		}

		var toggleVisibility = searchEl.parent('[component="category/dropdown"]').length > 0 ||
			searchEl.parent('[component="category-selector"]').length > 0;

		el.on('show.bs.dropdown', function () {
			if (toggleVisibility) {
				el.find('.dropdown-toggle').addClass('hidden');
				searchEl.removeClass('hidden');
			}

			function doSearch() {
				var val = searchEl.find('input').val();
				if (val.length > 1 || (!val && !categoriesList)) {
					loadList(val, function (categories) {
						categoriesList = categoriesList || categories;
						renderList(categories);
					});
				} else if (!val && categoriesList) {
					renderList(categoriesList);
				}
			}

			searchEl.on('click', function (ev) {
				ev.preventDefault();
				ev.stopPropagation();
			});
			searchEl.find('input').val('').on('keyup', utils.debounce(doSearch, 300));
			doSearch();
		});

		el.on('shown.bs.dropdown', function () {
			searchEl.find('input').focus();
		});

		el.on('hide.bs.dropdown', function () {
			if (toggleVisibility) {
				el.find('.dropdown-toggle').removeClass('hidden');
				searchEl.addClass('hidden');
			}

			searchEl.off('click');
			searchEl.find('input').off('keyup');
		});

		function loadList(query, callback) {
			socket.emit('categories.categorySearch', {
				query: query,
				parentCid: options.parentCid || 0,
				selectedCids: options.selectedCids,
				privilege: options.privilege,
				states: options.states,
				showLinks: options.showLinks,
			}, function (err, categories) {
				if (err) {
					return app.alertError(err);
				}
				callback(localCategories.concat(categories));
			});
		}

		function renderList(categories) {
			app.parseAndTranslate(options.template, {
				categoryItems: categories.slice(0, 200),
				selectedCategory: ajaxify.data.selectedCategory,
				allCategoriesUrl: ajaxify.data.allCategoriesUrl,
			}, function (html) {
				el.find('[component="category/list"]')
					.replaceWith(html.find('[component="category/list"]'));
				el.find('[component="category/list"] [component="category/no-matches"]')
					.toggleClass('hidden', !!categories.length);
			});
		}
	};

	return categorySearch;
});
