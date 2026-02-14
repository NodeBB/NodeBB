'use strict';

define('search', [
	'translator', 'storage', 'hooks', 'alerts', 'bootstrap',
], function (translator, storage, hooks, alerts, bootstrap) {
	const Search = {
		current: {},
	};

	Search.init = function (searchOptions) {
		if (!config.searchEnabled) {
			return;
		}

		searchOptions = searchOptions || { in: config.searchDefaultInQuick || 'titles' };
		const searchForm = $('[component="search/form"]');
		searchForm.each((index, form) => {
			init($(form), searchOptions);
		});
	};

	function init(searchForm, searchOptions) {
		const searchButton = searchForm.find('[component="search/button"]');
		const searchFields = searchForm.find('[component="search/fields"]');
		const searchInput = searchFields.find('input[name="query"]');

		const quickSearchContainer = searchFields.find('#quick-search-container');
		const toggleVisibility = searchFields.hasClass('hidden');
		const webfingerRegex = /^(@|acct:)?[\w-]+@.+$/; // should match src/activitypub/helpers.js

		if (toggleVisibility) {
			searchFields.off('focusout').on('focusout', function dismissSearch() {
				setTimeout(function () {
					if (!searchFields.find(':focus').length) {
						searchFields.addClass('hidden');
						searchButton.removeClass('hidden');
					}
				}, 200);
			});
		}

		searchInput.off('focus');

		const searchElements = {
			inputEl: searchInput,
			resultEl: quickSearchContainer,
		};

		Search.enableQuickSearch({
			searchOptions: searchOptions,
			searchElements: searchElements,
		});

		searchButton.off('click').on('click', function (e) {
			if (!config.loggedIn && !app.user.privileges['search:content']) {
				alerts.alert({
					message: '[[error:search-requires-login]]',
					timeout: 3000,
				});
				ajaxify.go('login');
				return false;
			}
			e.stopPropagation();

			Search.showAndFocusInput(searchForm);
			return false;
		});

		searchForm.off('submit').on('submit', function () {
			const input = $(this).find('input[name="query"]');
			const data = Search.getSearchPreferences();
			data.term = input.val();
			data.in = searchOptions.in;

			// Override search target if webfinger handle entered
			if (webfingerRegex.test(data.term)) {
				data.in = 'users';
			}

			hooks.fire('action:search.submit', {
				searchOptions: data,
				searchElements: searchElements,
			});
			Search.query(data, function () {
				input.val('');
				searchInput.trigger('blur');
			});

			return false;
		});
	}

	Search.enableQuickSearch = function (options) {
		if (!config.searchEnabled || !app.user.privileges['search:content']) {
			return;
		}

		const searchOptions = Object.assign({ in: config.searchDefaultInQuick || 'titles' }, options.searchOptions);
		const quickSearchResults = options.searchElements.resultEl;
		const inputEl = options.searchElements.inputEl;
		let oldValue = inputEl.val();
		const filterCategoryEl = quickSearchResults.find('.filter-category');

		function updateCategoryFilterName() {
			if (ajaxify.data.template.category && ajaxify.data.cid) {
				translator.translate('[[search:search-in-category, ' + ajaxify.data.name + ']]', function (translated) {
					const name = $('<div></div>').html(translated).text();
					filterCategoryEl.find('.name').text(name);
				});
			}
			filterCategoryEl.toggleClass('hidden', !(ajaxify.data.template.category && ajaxify.data.cid));
		}

		function doSearch() {
			options.searchOptions = Object.assign({}, searchOptions);
			options.searchOptions.term = inputEl.val();
			updateCategoryFilterName();

			if (ajaxify.data.template.category && ajaxify.data.cid) {
				if (filterCategoryEl.find('input[type="checkbox"]').is(':checked')) {
					options.searchOptions.categories = [ajaxify.data.cid];
					options.searchOptions.searchChildren = true;
				}
			}

			if (!options.hideDuringSearch) {
				quickSearchResults.removeClass('hidden').find('.quick-search-results-container').html('');
				quickSearchResults.find('.loading-indicator').removeClass('hidden');
			}

			hooks.fire('action:search.quick.start', options);
			options.searchOptions.searchOnly = 1;
			Search.api(options.searchOptions, function (data) {
				quickSearchResults.find('.loading-indicator').addClass('hidden');

				if (options.searchOptions.in === 'categories') {
					if (!data.categories || (options.hideOnNoMatches && !data.categories.length)) {
						return quickSearchResults.addClass('hidden').find('.quick-search-results-container').html('');
					}

					data.dropdown = { maxWidth: '400px', maxHeight: '500px', ...options.dropdown };
					app.parseAndTranslate('partials/quick-category-search-results', data, (html) => {
						if (html.length) {
							html.find('.timeago').timeago();
						}
						quickSearchResults.toggleClass('hidden', !html.length || !inputEl.is(':focus'))
							.find('.quick-search-results-container')
							.html(html.length ? html : '');

						hooks.fire('action:search.quick.complete', {
							data: data,
							options: options,
						});
					});
				} else {
					if (!data.posts || (options.hideOnNoMatches && !data.posts.length)) {
						return quickSearchResults.addClass('hidden').find('.quick-search-results-container').html('');
					}
					data.posts.forEach(function (p) {
						const text = $('<div>' + p.content + '</div>').text();
						const query = inputEl.val().toLowerCase().replace(/^in:topic-\d+/, '');
						const start = Math.max(0, text.toLowerCase().indexOf(query) - 40);
						p.snippet = utils.escapeHTML((start > 0 ? '...' : '') +
							text.slice(start, start + 80) +
							(text.length - start > 80 ? '...' : ''));
					});
					data.dropdown = { maxWidth: '400px', maxHeight: '500px', ...options.dropdown };
					app.parseAndTranslate('partials/quick-search-results', data, function (html) {
						if (html.length) {
							html.find('.timeago').timeago();
						}
						quickSearchResults.toggleClass('hidden', !html.length || !inputEl.is(':focus'))
							.find('.quick-search-results-container')
							.html(html.length ? html : '');
						const highlightEls = quickSearchResults.find(
							'.quick-search-results .quick-search-title, .quick-search-results .snippet'
						);
						Search.highlightMatches(options.searchOptions.term, highlightEls);
						hooks.fire('action:search.quick.complete', {
							data: data,
							options: options,
						});
					});
				}
			});
		}

		quickSearchResults.find('.filter-category input[type="checkbox"]').on('change', function () {
			inputEl.focus();
			doSearch();
		});

		inputEl.off('keyup').on('keyup', utils.debounce(function () {
			if (inputEl.val().length < 3) {
				quickSearchResults.addClass('hidden');
				oldValue = inputEl.val();
				return;
			}
			if (inputEl.val() === oldValue) {
				return;
			}
			oldValue = inputEl.val();
			if (!inputEl.is(':focus')) {
				return quickSearchResults.addClass('hidden');
			}
			doSearch();
		}, 500));

		quickSearchResults.on('mousedown', '.quick-search-results > *', function () {
			$(window).one('mouseup', function () {
				quickSearchResults.addClass('hidden');
			});
		});

		const inputParent = inputEl.parent();
		const resultParent = quickSearchResults.parent();
		inputParent.on('focusout', hideResults);
		resultParent.on('focusout', hideResults);
		function hideResults() {
			setTimeout(function () {
				if (!inputParent.find(':focus').length && !resultParent.find(':focus').length && !quickSearchResults.hasClass('hidden')) {
					quickSearchResults.addClass('hidden');
				}
			}, 200);
		}

		let ajaxified = false;
		hooks.on('action:ajaxify.end', function () {
			if (!ajaxify.isCold()) {
				ajaxified = true;
			}
			quickSearchResults.addClass('hidden');
		});

		inputEl.on('focus', function () {
			const query = inputEl.val();
			oldValue = query;
			if (query && quickSearchResults.find('#quick-search-results').children().length) {
				updateCategoryFilterName();
				if (ajaxified) {
					doSearch();
					ajaxified = false;
				} else {
					quickSearchResults.removeClass('hidden');
				}
				inputEl[0].setSelectionRange(
					query.startsWith('in:topic') ? query.indexOf(' ') + 1 : 0,
					query.length
				);
			}
		});

		inputEl.off('refresh').on('refresh', function () {
			doSearch();
		});
	};

	Search.showAndFocusInput = function (form) {
		const parentDropdown = form.parents('.dropdown-menu');
		if (parentDropdown.length) { // handle if form is inside a dropdown aka harmony
			const toggle = parentDropdown.siblings('[data-bs-toggle]');
			const dropdownEl = bootstrap.Dropdown.getOrCreateInstance(toggle[0]);
			if (dropdownEl) {
				dropdownEl.show();
			}
		} else { // persona and others
			form.find('[component="search/fields"]').removeClass('hidden');
			form.find('[component="search/button"]').addClass('hidden');
			form.find('[component="search/fields"] input[name="query"]').trigger('focus');
		}
	};

	Search.query = function (data, callback) {
		callback = callback || function () {};
		ajaxify.go('search?' + createQueryString(data), callback);
	};

	Search.api = function (data, callback) {
		const apiURL = config.relative_path + '/api/search?' + createQueryString(data);
		if (data.hasOwnProperty('searchOnly')) {
			delete data.searchOnly;
		}
		const searchURL = config.relative_path + '/search?' + createQueryString(data);
		$.get(apiURL, function (result) {
			result.url = searchURL;
			callback(result);
		});
	};

	function createQueryString(data) {
		const searchIn = data.in || 'titles';
		const term = data.term.replace(/^[ ?#]*/, '');

		const query = {
			...data,
			term: term,
			in: searchIn,
		};

		hooks.fire('action:search.createQueryString', {
			query: query,
			data: data,
		});

		return $.param(query);
	}

	Search.getSearchPreferences = function () {
		try {
			return JSON.parse(storage.getItem('search-preferences') || '{}');
		} catch (err) {
			console.error(err);
			return {};
		}
	};

	Search.highlightMatches = function (searchQuery, els) {
		if (!searchQuery || !els.length) {
			return;
		}
		searchQuery = utils.escapeHTML(searchQuery.replace(/^"/, '').replace(/"$/, '').trim());
		const regexStr = searchQuery.split(' ')
			.filter(word => word.length > 1)
			.map(function (word) { return utils.escapeRegexChars(word); })
			.join('|');
		const regex = new RegExp('(' + regexStr + ')', 'gi');

		els.each(function () {
			const result = $(this);
			const nested = [];

			result.find('*').each(function () {
				$(this).after('<!-- ' + nested.length + ' -->');
				nested.push($('<div></div>').append($(this)));
			});

			result.html(result.html().replace(regex, function (match, p1) {
				return '<strong class="search-match fw-bold text-decoration-underline">' + p1 + '</strong>';
			}));

			nested.forEach(function (nestedEl, i) {
				result.html(result.html().replace('<!-- ' + i + ' -->', function () {
					return nestedEl.html();
				}));
			});
		});

		$('.search-results .content').find('img:not(.not-responsive)').addClass('img-fluid');
	};

	return Search;
});
