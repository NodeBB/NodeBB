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
				var username = $('#search-user').val();

				if (username == '') {
					$('#user-notfound-notify').html('<i class="fa fa-circle-o"></i>');
					$('#user-notfound-notify').parent().removeClass('btn-warning label-warning btn-success label-success');
					return;
				}

				if (lastSearch === username) return;
				lastSearch = username;

				$('#user-notfound-notify').html('<i class="fa fa-spinner fa-spin"></i>');

				socket.emit('user.search', username, function(err, data) {
					if(err) {
						return app.alert(err.message);
					}

					if (!data) {
						$('#user-notfound-notify').html('You need to be logged in to search!');
						$('#user-notfound-notify').parent().addClass('btn-warning label-warning');
						return;
					}

					ajaxify.loadTemplate('users', function(usersTemplate) {
						var html = templates.parse(templates.getBlock(usersTemplate, 'users'), data);

						translator.translate(html, function(translated) {
							$('#users-container').html(translated);


							if (data && data.users.length === 0) {
								$('#user-notfound-notify').html('User not found!');
								$('#user-notfound-notify').parent().addClass('btn-warning label-warning');
							} else {
								$('#user-notfound-notify').html(data.users.length + ' user' + (data.users.length > 1 ? 's' : '') + ' found! Search took ' + data.timing + ' ms.');
								$('#user-notfound-notify').parent().addClass('btn-success label-success');
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
