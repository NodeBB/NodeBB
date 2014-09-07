'use strict';

/* globals define, socket, app, ajaxify, templates, translator*/

define('forum/users', function() {
	var	Users = {};

	var loadingMoreUsers = false;

	Users.init = function() {

		var active = getActiveSection();

		$('.nav-pills li').removeClass('active');
		$('.nav-pills li a').each(function() {
			var $this = $(this);
			if ($this.attr('href').match(active)) {
				$this.parent().addClass('active');
				return false;
			}
		});

		handleSearch();

		socket.removeListener('event:user_status_change', onUserStatusChange);
		socket.on('event:user_status_change', onUserStatusChange);

		$('#load-more-users-btn').on('click', loadMoreUsers);

		$(window).off('scroll').on('scroll', function() {
			var bottom = ($(document).height() - $(window).height()) * 0.9;

			if ($(window).scrollTop() > bottom && !loadingMoreUsers) {
				loadMoreUsers();
			}
		});
	};

	function loadMoreUsers() {
		var set = '';
		var activeSection = getActiveSection();
		if (activeSection === 'latest') {
			set = 'users:joindate';
		} else if (activeSection === 'sort-posts') {
			set = 'users:postcount';
		} else if (activeSection === 'sort-reputation') {
			set = 'users:reputation';
		} else if (activeSection === 'online' || activeSection === 'users') {
			set = 'users:online';
		}

		if (set) {
			startLoading(set, $('#users-container').children('.registered-user').length);
		}
	}

	function startLoading(set, after) {
		loadingMoreUsers = true;

		socket.emit('user.loadMore', {
			set: set,
			after: after
		}, function(err, data) {
			if (data && data.users.length) {
				onUsersLoaded(data.users);
				$('#load-more-users-btn').removeClass('disabled');
			} else {
				$('#load-more-users-btn').addClass('disabled');
			}
			loadingMoreUsers = false;
		});
	}

	function onUsersLoaded(users) {
		users = users.filter(function(user) {
			return !$('.users-box[data-uid="' + user.uid + '"]').length;
		});

		ajaxify.loadTemplate('users', function(usersTemplate) {
			var html = templates.parse(templates.getBlock(usersTemplate, 'users'), {users: users});

			translator.translate(html, function(translated) {
				$('#users-container').append(translated);
				$('#users-container .anon-user').appendTo($('#users-container'));
			});
		});
	}

	function handleSearch() {
		var timeoutId = 0;
		var lastSearch = null;

		$('#search-user').on('keyup', function() {
			if (timeoutId !== 0) {
				clearTimeout(timeoutId);
				timeoutId = 0;
			}

			timeoutId = setTimeout(function() {
				function reset() {
					notify.html('<i class="fa fa-search"></i>');
					notify.parent().removeClass('btn-warning label-warning btn-success label-success');
				}
				var username = $('#search-user').val();
				var notify = $('#user-notfound-notify');

				if (username === '') {
					notify.html('<i class="fa fa-circle-o"></i>');
					notify.parent().removeClass('btn-warning label-warning btn-success label-success');
					return;
				}

				if (lastSearch === username) {
					return;
				}
				lastSearch = username;

				notify.html('<i class="fa fa-spinner fa-spin"></i>');

				socket.emit('user.search', username, function(err, data) {
					if (err) {
						reset();
						return app.alertError(err.message);
					}

					if (!data) {
						reset();
						return;
					}

					ajaxify.loadTemplate('users', function(usersTemplate) {
						var html = templates.parse(templates.getBlock(usersTemplate, 'users'), data);

						translator.translate(html, function(translated) {
							$('#users-container').html(translated);
							if (!data.users.length) {
								translator.translate('[[users:user-not-found]]', function(translated) {
									notify.html(translated);
									notify.parent().addClass('btn-warning label-warning');
								});
							} else {
								translator.translate('[[users:users-found-search-took, ' + data.users.length + ', ' + data.timing + ']]', function(translated) {
									notify.html(translated);
									notify.parent().addClass('btn-success label-success');
								});
							}
						});
					});
				});

			}, 250);
		});
	}

	function onUserStatusChange(data) {
		var section = getActiveSection();
		if((section.indexOf('online') === 0 || section.indexOf('users') === 0)) {
			updateUser(data);
		}
	}

	function updateUser(data) {
		if (data.status === 'offline') {
			return;
		}
		var usersContainer = $('#users-container');
		var userEl = usersContainer.find('li[data-uid="' + data.uid +'"]');

		if (userEl.length) {
			var statusEl = userEl.find('.status');
			translator.translate('[[global:' + data.status + ']]', function(translated) {
				statusEl.attr('class', 'fa fa-circle status ' + data.status)
					.attr('title', translated)
					.attr('data-original-title', translated);
			});
		}
	}

	function getActiveSection() {
		var url = window.location.href,
			parts = url.split('/');
		return parts[parts.length - 1];
	}

	return Users;
});
