'use strict';


define('search', ['navigator', 'translator', 'storage', 'hooks'], function (nav, translator, storage, hooks) {
	const Search = {
		current: {},
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
			return app.alertError('[[error:invalid-search-term]]');
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
