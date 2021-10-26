'use strict';


define('forum/users', [
	'translator', 'benchpress', 'api', 'accounts/invite',
], function (translator, Benchpress, api, AccountInvite) {
	const	Users = {};

	let searchResultCount = 0;

	Users.init = function () {
		app.enterRoom('user_list');

		const section = utils.params().section ? ('?section=' + utils.params().section) : '';
		$('.nav-pills li').removeClass('active').find('a[href="' + window.location.pathname + section + '"]').parent()
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
	};

	function doSearch() {
		if (!ajaxify.data.template.users) {
			return;
		}
		$('[component="user/search/icon"]').removeClass('fa-search').addClass('fa-spinner fa-spin');
		const username = $('#search-user').val();
		const activeSection = getActiveSection();

		const query = {
			section: activeSection,
			page: 1,
		};

		if (!username) {
			return loadPage(query);
		}

		query.query = username;
		query.sortBy = getSortBy();
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
			.catch(app.alertError);
	}

	function renderSearchResults(data) {
		Benchpress.render('partials/paginator', { pagination: data.pagination }).then(function (html) {
			$('.pagination-container').replaceWith(html);
		});

		if (searchResultCount) {
			data.users = data.users.slice(0, searchResultCount);
		}

		data.isAdminOrGlobalMod = app.user.isAdmin || app.user.isGlobalMod;
		app.parseAndTranslate('users', 'users', data, function (html) {
			$('#users-container').html(html);
			html.find('span.timeago').timeago();
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
		return utils.params().section || '';
	}

	return Users;
});
