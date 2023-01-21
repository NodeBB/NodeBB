'use strict';


define('forum/search', [
	'search',
	'storage',
	'hooks',
	'alerts',
	'api',
	'translator',
	'slugify',
], function (searchModule, storage, hooks, alerts, api, translator, slugify) {
	const Search = {};
	let selectedUsers = [];

	Search.init = function () {
		const searchIn = $('#search-in');
		searchIn.on('change', function () {
			updateFormItemVisiblity(searchIn.val());
		});

		const searchQuery = $('#results').attr('data-search-query');
		searchModule.highlightMatches(
			searchQuery,
			$('.search-results .content p, .search-results .topic-title')
		);

		$('#advanced-search form').off('submit').on('submit', function (e) {
			e.preventDefault();
			searchModule.query(getSearchDataFromDOM(), function () {
				$('#search-input').val('');
			});
			return false;
		});

		handleSavePreferences();

		enableAutoComplete();

		userFilterDropdown($('[component="user/filter"]'), ajaxify.data.userFilterSelected);

		$('[component="search/filters"]').on('hidden.bs.dropdown', '.dropdown', function () {
			const updateFns = {
				replies: updateReplyCountFilter,
				time: updateTimeFilter,
				sort: updateSortFilter,
				user: updateUserFilter,
			};

			if (updateFns[$(this).attr('data-filter-name')]) {
				updateFns[$(this).attr('data-filter-name')]();
			}
		});

		fillOutForm();
	};

	function updateUserFilter() {
		const isActive = selectedUsers.length > 0;
		let labelText = '[[search:posted-by]]';
		if (selectedUsers.length) {
			labelText = translator.compile(
				'search:posted-by-usernames', selectedUsers.map(u => u.username).join(', ')
			);
		}
		$('[component="user/filter/button"]').toggleClass(
			'active-filter', isActive
		).find('.filter-label').translateText(labelText);
	}

	function updateTimeFilter() {
		const isActive = $('#post-time-range').val() > 0;
		$('#post-time-button').toggleClass(
			'active-filter', isActive
		).find('.filter-label').translateText(
			isActive ?
				`[[search:time-${$('#post-time-filter').val()}-than-${$('#post-time-range').val()}]]` :
				`[[search:time]]`
		);
	}

	function updateSortFilter() {
		const isActive = $('#post-sort-by').val() !== 'relevance' || $('#post-sort-direction').val() !== 'desc';
		$('#sort-by-button').toggleClass(
			'active-filter', isActive
		).find('.filter-label').translateText(
			isActive ?
				`[[search:sort-by-${$('#post-sort-by').val()}-${$('#post-sort-direction').val()}]]` :
				`[[search:sort]]`
		);
	}

	function updateReplyCountFilter() {
		const isActive = $('#reply-count').val() > 0;
		$('#reply-count-button').toggleClass(
			'active-filter', isActive
		).find('.filter-label').translateText(
			isActive ?
				`[[search:replies-${$('#reply-count-filter').val()}-count, ${$('#reply-count').val()}]]` :
				`[[search:replies]]`
		);
	}

	function getSearchDataFromDOM() {
		const form = $('#advanced-search');
		const searchData = {
			in: $('#search-in').val(),
		};
		searchData.term = $('#search-input').val();
		if (searchData.in === 'posts' || searchData.in === 'titlesposts' || searchData.in === 'titles') {
			searchData.matchWords = form.find('#match-words-filter').val();
			searchData.by = selectedUsers.length ? selectedUsers.map(u => u.username) : undefined;
			searchData.categories = form.find('#posted-in-categories').val();
			searchData.searchChildren = form.find('#search-children').is(':checked');
			searchData.hasTags = form.find('#has-tags').tagsinput('items');
			searchData.replies = form.find('#reply-count').val();
			searchData.repliesFilter = form.find('#reply-count-filter').val();
			searchData.timeFilter = form.find('#post-time-filter').val();
			searchData.timeRange = form.find('#post-time-range').val();
			searchData.sortBy = form.find('#post-sort-by').val();
			searchData.sortDirection = form.find('#post-sort-direction').val();
			searchData.showAs = form.find('#show-results-as').val();
		}

		hooks.fire('action:search.getSearchDataFromDOM', {
			form: form,
			data: searchData,
		});

		return searchData;
	}

	function updateFormItemVisiblity(searchIn) {
		const hideTitlePostFilters = !searchIn.includes('posts') && !searchIn.includes('titles');
		$('.post-search-item').toggleClass('hidden', hideTitlePostFilters);
	}

	function fillOutForm() {
		const params = utils.params({
			disableToType: true,
		});

		const searchData = searchModule.getSearchPreferences();
		const formData = utils.merge(searchData, params);

		if (formData) {
			if (ajaxify.data.term) {
				$('#search-input').val(ajaxify.data.term);
			}
			formData.in = formData.in || ajaxify.data.searchDefaultIn;
			$('#search-in').val(formData.in);
			updateFormItemVisiblity(formData.in);

			if (formData.matchWords) {
				$('#match-words-filter').val(formData.matchWords);
			}

			if (formData.showAs) {
				$('#show-results-as').val(formData.showAs);
			}

			if (formData.by) {
				formData.by = Array.isArray(formData.by) ? formData.by : [formData.by];
				formData.by.forEach(function (by) {
					$('#posted-by-user').tagsinput('add', by);
				});
			}

			if (formData.categories) {
				$('#posted-in-categories').val(formData.categories);
			}

			if (formData.searchChildren) {
				$('#search-children').prop('checked', true);
			}

			if (formData.hasTags) {
				formData.hasTags = Array.isArray(formData.hasTags) ? formData.hasTags : [formData.hasTags];
				formData.hasTags.forEach(function (tag) {
					$('#has-tags').tagsinput('add', tag);
				});
			}

			if (formData.replies) {
				$('#reply-count').val(formData.replies);
				$('#reply-count-filter').val(formData.repliesFilter);
			}

			if (formData.timeRange) {
				$('#post-time-range').val(formData.timeRange);
				$('#post-time-filter').val(formData.timeFilter);
			}

			if (formData.sortBy || ajaxify.data.searchDefaultSortBy) {
				$('#post-sort-by').val(formData.sortBy || ajaxify.data.searchDefaultSortBy);
			}
			$('#post-sort-direction').val(formData.sortDirection || 'desc');

			hooks.fire('action:search.fillOutForm', {
				form: formData,
			});
		}
	}

	function handleSavePreferences() {
		$('#save-preferences').on('click', function () {
			storage.setItem('search-preferences', JSON.stringify(getSearchDataFromDOM()));
			alerts.success('[[search:search-preferences-saved]]');
			return false;
		});

		$('#clear-preferences').on('click', async function () {
			storage.removeItem('search-preferences');
			const html = await app.parseAndTranslate('partials/search-filters', {});
			$('[component="search/filters"]').replaceWith(html);
			// clearing dom removes all event handlers, reinitialize
			userFilterDropdown($('[component="user/filter"]'), []);
			alerts.success('[[search:search-preferences-cleared]]');
			return false;
		});
	}

	function userFilterDropdown(el, _selectedUsers) {
		selectedUsers = _selectedUsers;
		async function renderSelectedUsers() {
			const html = await app.parseAndTranslate('partials/search-filters', 'userFilterSelected', {
				userFilterSelected: selectedUsers,
			});
			el.find('[component="user/filter/selected"]').html(html);
		}

		async function doSearch() {
			let result = { users: [] };
			const query = el.find('[component="user/filter/search"]').val();
			if (query && query.length > 1) {
				if (app.user.privileges['search:users']) {
					result = await api.get('/api/users', { query: query });
				} else {
					try {
						const userData = await api.get(`/api/user/${slugify(query)}`);
						result.users.push(userData);
					} catch (err) {}
				}
			}
			if (!result.users.length) {
				el.find('[component="user/filter/results"]').translateHtml(
					'[[users:no-users-found]]'
				);
				return;
			}
			result.users = result.users.slice(0, 20);
			const html = await app.parseAndTranslate('partials/search-filters', 'userFilterResults', {
				userFilterResults: result.users,
			});
			const uidToUser = {};
			result.users.forEach((user) => {
				uidToUser[user.uid] = user;
			});
			el.find('[component="user/filter/results"]').html(html);
			el.find('[component="user/filter/results"] [data-uid]').on('click', async function () {
				selectedUsers.push(uidToUser[$(this).attr('data-uid')]);
				renderSelectedUsers();
			});
		}

		el.find('[component="user/filter/search"]').on('keyup', utils.debounce(function () {
			if (app.user.privileges['search:users']) {
				doSearch();
			}
		}, 1000));

		el.on('click', '[component="user/filter/delete"]', function () {
			const uid = $(this).attr('data-uid');
			selectedUsers = selectedUsers.filter(u => parseInt(u.uid, 10) !== parseInt(uid, 10));
			renderSelectedUsers();
		});

		el.find('[component="user/filter/search"]').on('keyup', (e) => {
			if (e.key === 'Enter' && !app.user.privileges['search:users']) {
				doSearch();
			}
		});

		el.on('shown.bs.dropdown', function () {
			el.find('[component="user/filter/search"]').trigger('focus');
		});
	}

	function enableAutoComplete() {
		// const userEl = $('#posted-by-user');
		// userEl.tagsinput({
		// 	tagClass: 'badge bg-info',
		// 	confirmKeys: [13, 44],
		// 	trimValue: true,
		// });
		// if (app.user.privileges['search:users']) {
		// 	autocomplete.user(userEl.siblings('.bootstrap-tagsinput').find('input'));
		// }

		// const tagEl = $('#has-tags');
		// tagEl.tagsinput({
		// 	tagClass: 'badge bg-info',
		// 	confirmKeys: [13, 44],
		// 	trimValue: true,
		// });
		// if (app.user.privileges['search:tags']) {
		// 	autocomplete.tag(tagEl.siblings('.bootstrap-tagsinput').find('input'));
		// }
	}

	return Search;
});
