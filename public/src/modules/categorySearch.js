'use strict';

define('categorySearch', ['alerts', 'bootstrap', 'api'], function (alerts, bootstrap, api) {
	const categorySearch = {};

	categorySearch.init = function (el, options) {
		let categoriesList = options.defaultCategories || null;
		options = options || {};
		options.privilege = options.privilege || 'topics:read';
		options.states = options.states || ['watching', 'tracking', 'notwatching', 'ignoring'];
		options.cacheList = options.hasOwnProperty('cacheList') ? options.cacheList : true;

		let localCategories = [];
		if (Array.isArray(options.localCategories)) {
			localCategories = options.localCategories.map(c => ({ ...c }));
			if (categoriesList) {
				categoriesList = [...localCategories, ...categoriesList];
			}
		}
		options.selectedCids = options.selectedCids || ajaxify.data.selectedCids || [];

		const searchEl = el.find('[component="category-selector-search"]');
		if (!searchEl.length) {
			return;
		}

		const toggleVisibility = searchEl.parents('[component="category/dropdown"]').length > 0 ||
			searchEl.parents('[component="category-selector"]').length > 0;

		el.on('show.bs.dropdown', function () {
			if (toggleVisibility) {
				searchEl.removeClass('hidden');
			}

			function doSearch() {
				const val = searchEl.find('input').val();
				if (val.length > 1 || (!val && !categoriesList)) {
					loadList(val, function (categories) {
						categoriesList = options.cacheList && (categoriesList || categories);
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
			if (!['xs', 'sm'].includes(utils.findBootstrapEnvironment())) {
				searchEl.find('input').focus();
			}
		});

		el.on('hide.bs.dropdown', function () {
			if (toggleVisibility) {
				searchEl.addClass('hidden');
			}

			searchEl.off('click');
			searchEl.find('input').off('keyup');
		});

		function loadList(search, callback) {
			api.get('/search/categories', {
				search: search,
				query: utils.params(),
				parentCid: options.parentCid || 0,
				selectedCids: options.selectedCids,
				privilege: options.privilege,
				states: options.states,
				showLinks: options.showLinks,
				localOnly: options.localOnly,
				hideUncategorized: options.hideUncategorized,
			}, function (err, { categories }) {
				if (err) {
					return alerts.error(err);
				}
				callback(localCategories.concat(categories));
			});
		}

		function renderList(categories) {
			const selectedCids = options.selectedCids.map(String);
			categories.forEach(function (c) {
				c.selected = selectedCids.includes(String(c.cid));
			});
			app.parseAndTranslate(options.template, {
				categoryItems: categories.slice(0, 200),
				selectedCategory: ajaxify.data.selectedCategory,
				allCategoriesUrl: ajaxify.data.allCategoriesUrl,
				hideAll: options.hideAll,
			}, function (html) {
				el.find('[component="category/list"]')
					.html(html.find('[component="category/list"]').html());
				el.find('[component="category/list"] [component="category/no-matches"]')
					.toggleClass('hidden', !!categories.length);

				const bsDropdown = bootstrap.Dropdown.getInstance(el.find('.dropdown-toggle').get(0));
				if (bsDropdown) {
					bsDropdown.update();
				}
			});
		}
	};

	return categorySearch;
});
