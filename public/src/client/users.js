'use strict';


define('forum/users', [
	'translator', 'benchpress', 'api', 'bootbox',
], function (translator, Benchpress, api, bootbox) {
	var	Users = {};

	var searchTimeoutID = 0;
	var searchResultCount = 0;

	$(window).on('action:ajaxify.start', function () {
		if (searchTimeoutID) {
			clearTimeout(searchTimeoutID);
			searchTimeoutID = 0;
		}
	});

	Users.init = function () {
		app.enterRoom('user_list');

		var section = utils.params().section ? ('?section=' + utils.params().section) : '';
		$('.nav-pills li').removeClass('active').find('a[href="' + window.location.pathname + section + '"]').parent()
			.addClass('active');

		Users.handleSearch();

		handleInvite();

		socket.removeListener('event:user_status_change', onUserStatusChange);
		socket.on('event:user_status_change', onUserStatusChange);
	};

	Users.handleSearch = function (params) {
		searchResultCount = params && params.resultCount;
		searchTimeoutID = 0;

		$('#search-user').on('keyup', function () {
			if (searchTimeoutID) {
				clearTimeout(searchTimeoutID);
				searchTimeoutID = 0;
			}

			searchTimeoutID = setTimeout(doSearch, 250);
		});

		$('.search select, .search input[type="checkbox"]').on('change', function () {
			doSearch();
		});
	};

	function doSearch() {
		$('[component="user/search/icon"]').removeClass('fa-search').addClass('fa-spinner fa-spin');
		var username = $('#search-user').val();
		var activeSection = getActiveSection();

		var query = {
			section: activeSection,
			page: 1,
		};

		if (!username) {
			return loadPage(query);
		}

		query.query = username;
		query.sortBy = getSortBy();
		var filters = [];
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
		var sortBy;
		var activeSection = getActiveSection();
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
		var section = getActiveSection();

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

	function handleInvite() {
		$('[component="user/invite"]').on('click', function (e) {
			e.preventDefault();
			api.get(`/api/v3/users/${app.user.uid}/invites/groups`, {}).then((groups) => {
				Benchpress.parse('modals/invite', { groups: groups }, function (html) {
					bootbox.dialog({
						message: html,
						title: '[[users:invite]]',
						onEscape: true,
						buttons: {
							cancel: {
								label: '[[modules:bootbox.cancel]]',
								className: 'btn-default',
							},
							invite: {
								label: '[[users:invite]]',
								className: 'btn-primary',
								callback: sendInvites,
							},
						},
					});
				});
			}).catch((err) => {
				app.alertError(err.message);
			});
		});
	}

	function sendInvites() {
		var $emails = $('#invite-modal-emails');
		var $groups = $('#invite-modal-groups');

		var data = {
			emails: $emails.val()
				.split(',')
				.map(m => m.trim())
				.filter(Boolean)
				.filter((m, i, arr) => i === arr.indexOf(m))
				.join(','),
			groupsToJoin: $groups.val(),
		};

		if (!data.emails) {
			return;
		}

		api.post(`/users/${app.user.uid}/invites`, data).then(() => {
			app.alertSuccess('[[users:invitation-email-sent, ' + data.emails.replace(/,/g, '&#44; ') + ']]');
		}).catch((err) => {
			app.alertError(err.message);
		});
	}

	return Users;
});
