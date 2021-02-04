'use strict';

define('categorySearch2', function () {
	var categorySearch = {};

	var categoriesList;
	var options;

	// copy of ajaxify.data.categories to add custom categories to list
	// see admin/manage/privileges
	var localCategories;

	categorySearch.init = function (el, _options) {
		if (utils.isTouchDevice()) {
			return;
		}
		categoriesList = null;
		options = _options || {};

		localCategories = Array.isArray(ajaxify.data.categories) ? ajaxify.data.categories.map(c => ({ ...c })) : [];

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
						renderList(el, categories);
					});
				} else if (!val && categoriesList) {
					renderList(el, categoriesList);
				}
			}

			searchEl.on('click', function (ev) {
				ev.preventDefault();
				ev.stopPropagation();
			});
			searchEl.find('input').val('').on('keyup', utils.debounce(doSearch, 200));
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
	};

	function loadList(query, callback) {
		socket.emit('categories.loadCategoryFilter', {
			query: query,
			selectedCids: ajaxify.data.selectedCids,
		}, function (err, categories) {
			if (err) {
				return app.alertError(err);
			}
			callback(localCategories.concat(categories));
		});
	}

	function renderList(el, categories) {
		app.parseAndTranslate(options.template, {
			categories: categories.slice(0, 200),
			selectedCategory: ajaxify.data.selectedCategory,
			allCategoriesUrl: ajaxify.data.allCategoriesUrl,
		}, function (html) {
			el.find('[component="category/list"]')
				.replaceWith(html.find('[component="category/list"]'));
		});
	}

	return categorySearch;
});
