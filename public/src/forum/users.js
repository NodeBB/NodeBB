define('forum/users', function() {
	var	Users = {};

	Users.init = function() {
		var timeoutId = 0;
		var loadingMoreUsers = false;

		function getActiveSection() {
			var url = window.location.href,
			parts = url.split('/'),
			active = parts[parts.length - 1];
			return active;
		}

		var active = getActiveSection();

		var lastSearch = null;

		$('.nav-pills li').removeClass('active');
		$('.nav-pills li a').each(function() {
			var $this = $(this);
			if ($this.attr('href').match(active)) {
				$this.parent().addClass('active');
				return false;
			}
		});

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

		socket.on('user.isOnline', function(err, data) {
			var section = getActiveSection();
			if((section.indexOf('online') === 0 || section.indexOf('users') === 0)  && !loadingMoreUsers) {
				startLoading('users:online', 0, true);
				updateAnonCount();
			}
		});

		socket.on('user.anonDisconnect', updateAnonCount);
		socket.on('user.anonConnect', updateAnonCount)

		function updateAnonCount() {
			var section = getActiveSection();
			if((section.indexOf('online') === 0 || section.indexOf('users') === 0)  && !loadingMoreUsers) {
				socket.emit('user.getOnlineAnonCount', {} , function(err, anonCount) {

					if(parseInt(anonCount, 10) > 0) {
						$('#users-container .anon-user').removeClass('hide');
						$('#online_anon_count').html(anonCount);
					} else {
						$('#users-container .anon-user').addClass('hide');
					}
				});
			}
		}

		function onUsersLoaded(users, emptyContainer) {
			ajaxify.loadTemplate('users', function(usersTemplate) {
				var html = templates.parse(templates.getBlock(usersTemplate, 'users'), {users: users});

				translator.translate(html, function(translated) {
					if(emptyContainer) {
						$('#users-container .registered-user').remove();
					}

					$('#users-container').append(translated);
					$('#users-container .anon-user').appendTo($('#users-container'));
				});
			});
		}

		function loadMoreUsers() {
			var set = '';
			if (active === 'latest') {
				set = 'users:joindate';
			} else if (active === 'sort-posts') {
				set = 'users:postcount';
			} else if (active === 'sort-reputation') {
				set = 'users:reputation';
			} else if (active === 'online' || active === 'users') {
				set = 'users:online';
			}

			if (set) {
				startLoading(set, $('#users-container').children('.registered-user').length);
			}
		}

		function startLoading(set, after, emptyContainer) {
			loadingMoreUsers = true;

			socket.emit('user.loadMore', {
				set: set,
				after: after
			}, function(err, data) {
				if (data && data.users.length) {
					onUsersLoaded(data.users, emptyContainer);
					$('#load-more-users-btn').removeClass('disabled');
				} else {
					$('#load-more-users-btn').addClass('disabled');
				}
				loadingMoreUsers = false;
			});
		}


		$('#load-more-users-btn').on('click', loadMoreUsers);

		$(window).off('scroll').on('scroll', function() {
			var bottom = ($(document).height() - $(window).height()) * 0.9;

			if ($(window).scrollTop() > bottom && !loadingMoreUsers) {
				loadMoreUsers();
			}
		});
	};

	return Users;
});
