'use strict';

define('search', ['translator', 'storage', 'hooks', 'alerts'], function (translator, storage, hooks, alerts) {
	const Search = {
		current: {},
	};

	Search.init = function (searchOptions) {
		if (!config.searchEnabled) {
			return;
		}

		searchOptions = searchOptions || { in: config.searchDefaultInQuick || 'titles' };
		const searchButton = $('#search-button');
		const searchFields = $('#search-fields');
		const searchInput = $('#search-fields input');
		const quickSearchContainer = $('#quick-search-container');

		$('#search-form .advanced-search-link').off('mousedown').on('mousedown', function () {
			ajaxify.go('/search');
		});

		$('#search-form').off('submit').on('submit', function () {
			searchInput.blur();
		});
		searchInput.off('blur').on('blur', function dismissSearch() {
			setTimeout(function () {
				if (!searchInput.is(':focus')) {
					searchFields.addClass('hidden');
					searchButton.removeClass('hidden');
				}
			}, 200);
		});
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

			Search.showAndFocusInput();
			return false;
		});

		$('#search-form').off('submit').on('submit', function () {
			const input = $(this).find('input');
			const data = Search.getSearchPreferences();
			data.term = input.val();
			hooks.fire('action:search.submit', {
				searchOptions: data,
				searchElements: searchElements,
			});
			Search.query(data, function () {
				input.val('');
			});

			return false;
		});
	};

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
			if (ajaxify.data.template.category) {
				translator.translate('[[search:search-in-category, ' + ajaxify.data.name + ']]', function (translated) {
					const name = $('<div></div>').html(translated).text();
					filterCategoryEl.find('.name').text(name);
				});
			}
			filterCategoryEl.toggleClass('hidden', !ajaxify.data.template.category);
		}

		function doSearch() {
			options.searchOptions = Object.assign({}, searchOptions);
			options.searchOptions.term = inputEl.val();
			updateCategoryFilterName();

			if (ajaxify.data.template.category) {
				if (filterCategoryEl.find('input[type="checkbox"]').is(':checked')) {
					options.searchOptions.categories = [ajaxify.data.cid];
					options.searchOptions.searchChildren = true;
				}
			}

			quickSearchResults.removeClass('hidden').find('.quick-search-results-container').html('');
			quickSearchResults.find('.loading-indicator').removeClass('hidden');
			hooks.fire('action:search.quick.start', options);
			options.searchOptions.searchOnly = 1;
			Search.api(options.searchOptions, function (data) {
				quickSearchResults.find('.loading-indicator').addClass('hidden');
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

		let mousedownOnResults = false;
		quickSearchResults.on('mousedown', function () {
			$(window).one('mouseup', function () {
				quickSearchResults.addClass('hidden');
			});
			mousedownOnResults = true;
		});
		inputEl.on('blur', function () {
			if (!inputEl.is(':focus') && !mousedownOnResults && !quickSearchResults.hasClass('hidden')) {
				quickSearchResults.addClass('hidden');
			}
		});

		let ajaxified = false;
		hooks.on('action:ajaxify.end', function () {
			if (!ajaxify.isCold()) {
				ajaxified = true;
			}
		});

		inputEl.on('focus', function () {
			mousedownOnResults = false;
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

	Search.showAndFocusInput = function () {
		$('#search-fields').removeClass('hidden');
		$('#search-button').addClass('hidden');
		$('#search-fields input').focus();
	};

	Search.query = function (data, callback) {
		callback = callback || function () {};
		ajaxify.go('search?' + createQueryString(data));
		callback();
	};

	Search.api = function (data, callback) {
		const apiURL = config.relative_path + '/api/search?' + createQueryString(data);
		data.searchOnly = undefined;
		const searchURL = config.relative_path + '/search?' + createQueryString(data);
		$.get(apiURL, function (result) {
			result.url = searchURL;
			callback(result);
		});
	};

	function createQueryString(data) {
		const searchIn = data.in || 'titles';
		const postedBy = data.by || '';
		let term = data.term.replace(/^[ ?#]*/, '');
		try {
			term = encodeURIComponent(term);
		} catch (e) {
			return alerts.error('[[error:invalid-search-term]]');
		}

		const query = {
			term: term,
			in: searchIn,
		};

		if (data.matchWords) {
			query.matchWords = data.matchWords;
		}

		if (postedBy && postedBy.length && (searchIn === 'posts' || searchIn === 'titles' || searchIn === 'titlesposts')) {
			query.by = postedBy;
		}

		if (data.categories && data.categories.length) {
			query.categories = data.categories;
			if (data.searchChildren) {
				query.searchChildren = data.searchChildren;
			}
		}

		if (data.hasTags && data.hasTags.length) {
			query.hasTags = data.hasTags;
		}

		if (parseInt(data.replies, 10) > 0) {
			query.replies = data.replies;
			query.repliesFilter = data.repliesFilter || 'atleast';
		}

		if (data.timeRange) {
			query.timeRange = data.timeRange;
			query.timeFilter = data.timeFilter || 'newer';
		}

		if (data.sortBy) {
			query.sortBy = data.sortBy;
			query.sortDirection = data.sortDirection;
		}

		if (data.showAs) {
			query.showAs = data.showAs;
		}

		if (data.searchOnly) {
			query.searchOnly = data.searchOnly;
		}

		hooks.fire('action:search.createQueryString', {
			query: query,
			data: data,
		});

		return decodeURIComponent($.param(query));
	}

	Search.getSearchPreferences = function () {
		try {
			return JSON.parse(storage.getItem('search-preferences') || '{}');
		} catch (e) {
			return {};
		}
	};

	Search.highlightMatches = function (searchQuery, els) {
		if (!searchQuery || !els.length) {
			return;
		}
		searchQuery = utils.escapeHTML(searchQuery.replace(/^"/, '').replace(/"$/, '').trim());
		const regexStr = searchQuery.split(' ')
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
				return '<strong class="search-match">' + p1 + '</strong>';
			}));

			nested.forEach(function (nestedEl, i) {
				result.html(result.html().replace('<!-- ' + i + ' -->', function () {
					return nestedEl.html();
				}));
			});
		});

		$('.search-result-text').find('img:not(.not-responsive)').addClass('img-responsive');
	};

	return Search;
});
