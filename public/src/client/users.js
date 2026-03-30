'use strict';


define('forum/users', [
	'api', 'alerts', 'accounts/invite',
], function (api, alerts, AccountInvite) {
	const Users = {};

	let searchResultCount = 0;

	Users.init = function () {
		app.enterRoom('user_list');

		const section = utils.param('section') ? ('?section=' + utils.param('section')) : '';
		const navItems = $('[component="user/list/menu"]');
		navItems.find('a').removeClass('active');
		navItems.find('a[href="' + window.location.pathname + section + '"]')
			.addClass('active');

		Users.handleSearch();

		AccountInvite.handle();

		socket.removeListener('event:user_status_change', onUserStatusChange);
		socket.on('event:user_status_change', onUserStatusChange);
	};

	Users.handleSearch = function (params) {
		searchResultCount = params && params.resultCount;
		$('#search-user').on('keyup', utils.debounce(doSearch, 250));
		$('.search select, .search input[type="checkbox"]').on('change', doSearch);

		// Populate box with query if present
		const searchEl = document.getElementById('search-user');
		if (searchEl) {
			const search = new URLSearchParams(document.location.search);
			const query = search.get('query');
			if (query) {
				searchEl.value = query;
			}
			if (!utils.isMobile()) {
				searchEl.focus();
			}
		}
	};

	function doSearch() {
		if (!ajaxify.data.template.users) {
			return;
		}
		$('[component="user/search/icon"]').removeClass('fa-search').addClass('fa-spinner fa-spin');
		const activeSection = getActiveSection();

		const query = {
			section: activeSection || 'users',
			page: 1,
		};

		const username = $('#search-user').val();
		if (username) {
			query.query = username;
		} else {
			return loadPage(query);
		}

		const sortBy = getSortBy();
		if (sortBy) {
			query.sortBy = sortBy;
		}

		const filters = [];
		if ($('.search .online-only').is(':checked') || (activeSection === 'online')) {
			filters.push('online');
		}
		if (activeSection === 'banned') {
			filters.push('banned');
		}
		if (activeSection === 'flagged') {
			filters.push('flagged');
		}
		if (filters.length) {
			query.filters = filters;
		}

		loadPage(query);
	}

	function getSortBy() {
		let sortBy;
		const activeSection = getActiveSection();
		if (activeSection === 'sort-posts') {
			sortBy = 'postcount';
		} else if (activeSection === 'sort-reputation') {
			sortBy = 'reputation';
		} else if (activeSection === 'users') {
			sortBy = 'joindate';
		}
		return sortBy;
	}


	function loadPage(query) {
		api.get('/api/users', query)
			.then(renderSearchResults)
			.catch(alerts.error);

		// Update query string
		const search = new URLSearchParams(query);
		ajaxify.updateHistory(`users?${search.toString()}`, true);
	}

	function renderSearchResults(data) {
		app.parseAndTranslate('partials/paginator', {
			pagination: data.pagination,
		}).then(function (html) {
			$('.pagination-container').replaceWith(html);
		});

		if (searchResultCount) {
			data.users = data.users.slice(0, searchResultCount);
		}

		data.isAdminOrGlobalMod = app.user.isAdmin || app.user.isGlobalMod;
		app.parseAndTranslate('users', 'users', data, function (html) {
			$('#users-container').html(html);
			html.find('.timeago').timeago();
			$('[component="user/search/icon"]').addClass('fa-search').removeClass('fa-spinner fa-spin');
		});
	}

	function onUserStatusChange(data) {
		const section = getActiveSection();

		if ((section.startsWith('online') || section.startsWith('users'))) {
			updateUser(data);
		}
	}

	function updateUser(data) {
		app.updateUserStatus($('#users-container [data-uid="' + data.uid + '"] [component="user/status"]'), data.status);
	}

	function getActiveSection() {
		return utils.param('section') || '';
	}

	return Users;
});
