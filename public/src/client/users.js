'use strict';


define('forum/users', ['translator', 'benchpress'], function (translator, Benchpress) {
	var	Users = {};

	var searchTimeoutID = 0;

	$(window).on('action:ajaxify.start', function () {
		if (searchTimeoutID) {
			clearTimeout(searchTimeoutID);
			searchTimeoutID = 0;
		}
	});

	Users.init = function () {
		app.enterRoom('user_list');

		var section = utils.params().section ? ('?section=' + utils.params().section) : '';
		$('.nav-pills li').removeClass('active').find('a[href="' + window.location.pathname + section + '"]').parent().addClass('active');

		handleSearch();

		handleInvite();

		socket.removeListener('event:user_status_change', onUserStatusChange);
		socket.on('event:user_status_change', onUserStatusChange);
	};

	function handleSearch() {
		searchTimeoutID = 0;

		$('#search-user').on('keyup', function () {
			if (searchTimeoutID) {
				clearTimeout(searchTimeoutID);
				searchTimeoutID = 0;
			}

			searchTimeoutID = setTimeout(doSearch, 150);
		});

		$('.search select, .search input[type="checkbox"]').on('change', function () {
			doSearch();
		});
	}

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

		query.term = username;
		query.sortBy = getSortBy();

		if ($('.search .online-only').is(':checked') || (activeSection === 'online')) {
			query.onlineOnly = true;
		}
		if (activeSection === 'banned') {
			query.bannedOnly = true;
		}
		if (activeSection === 'flagged') {
			query.flaggedOnly = true;
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
		var qs = decodeURIComponent($.param(query));
		$.get(config.relative_path + '/api/users?' + qs, renderSearchResults).fail(function (xhrErr) {
			if (xhrErr && xhrErr.responseJSON && xhrErr.responseJSON.error) {
				app.alertError(xhrErr.responseJSON.error);
			}
		});
	}

	function renderSearchResults(data) {
		Benchpress.parse('partials/paginator', { pagination: data.pagination }, function (html) {
			$('.pagination-container').replaceWith(html);
		});

		Benchpress.parse('users', 'users', data, function (html) {
			translator.translate(html, function (translated) {
				translated = $(translated);
				$('#users-container').html(translated);
				translated.find('span.timeago').timeago();
				$('[component="user/search/icon"]').addClass('fa-search').removeClass('fa-spinner fa-spin');
			});
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
		$('[component="user/invite"]').on('click', function () {
			bootbox.prompt('[[users:prompt-email]]', function (email) {
				if (!email) {
					return;
				}

				socket.emit('user.invite', email, function (err) {
					if (err) {
						return app.alertError(err.message);
					}
					app.alertSuccess('[[users:invitation-email-sent, ' + email + ']]');
				});
			});
		});
	}

	return Users;
});
