(function() {

	$(document).ready(function() {
		var timeoutId = 0;
		var loadingMoreUsers = false;

		var url = window.location.href,
			parts = url.split('/'),
			active = parts[parts.length - 1];

		var lastSearch = null;

		app.addCommasToNumbers();

		jQuery('.nav-pills li').removeClass('active');
		jQuery('.nav-pills li a').each(function() {
			if (this.getAttribute('href').match(active)) {
				jQuery(this.parentNode).addClass('active');
				return false;
			}
		});

		jQuery('#search-user').on('keyup', function() {
			if (timeoutId !== 0) {
				clearTimeout(timeoutId);
				timeoutId = 0;
			}

			timeoutId = setTimeout(function() {
				var username = $('#search-user').val();

				if (username == '') {
					jQuery('#user-notfound-notify').html('<i class="icon icon-circle-blank"></i>');
					jQuery('#user-notfound-notify').parent().removeClass('btn-warning label-warning btn-success label-success');
					return;
				}

				if (lastSearch === username) return;
				lastSearch = username;

				jQuery('#user-notfound-notify').html('<i class="icon-spinner icon-spin"></i>');

				setTimeout(function() {
					socket.emit('api:admin.user.search', username);
				}, 500); //replace this with global throttling function/constant

			}, 250);
		});

		socket.removeAllListeners('api:admin.user.search');

		socket.on('api:admin.user.search', function(data) {
			if (data === null) {
				$('#user-notfound-notify').html('You need to be logged in to search!');
				$('#user-notfound-notify').parent().addClass('btn-warning label-warning');
				return;
			}

			var html = templates.prepare(templates['users'].blocks['users']).parse({
				users: data
			}),
				userListEl = document.querySelector('#users-container');

			userListEl.innerHTML = html;


			if (data && data.length === 0) {
				$('#user-notfound-notify').html('User not found!');
				$('#user-notfound-notify').parent().addClass('btn-warning label-warning');
			} else {
				$('#user-notfound-notify').html(data.length + ' user' + (data.length > 1 ? 's' : '') + ' found!');
				$('#user-notfound-notify').parent().addClass('btn-success label-success');
			}

		});



		function onUsersLoaded(users) {
			var html = templates.prepare(templates['users'].blocks['users']).parse({
				users: users
			});
			$('#users-container').append(html);
		}

		function loadMoreUsers() {
			var set = '';
			if (active === 'users-latest' || active === 'users') {
				set = 'users:joindate';
			} else if (active === 'users-sort-posts') {
				set = 'users:postcount';
			} else if (active === 'users-sort-reputation') {
				set = 'users:reputation';
			}

			if (set) {
				loadingMoreUsers = true;
				socket.emit('api:users.loadMore', {
					set: set,
					after: $('#users-container').children().length
				}, function(data) {
					if (data.users.length) {
						onUsersLoaded(data.users);
					} else {
						$('#load-more-users-btn').addClass('disabled');
					}
					loadingMoreUsers = false;
				});
			}
		}

		$('#load-more-users-btn').on('click', loadMoreUsers);

		$(window).off('scroll').on('scroll', function() {
			var bottom = ($(document).height() - $(window).height()) * 0.9;

			if ($(window).scrollTop() > bottom && !loadingMoreUsers) {
				loadMoreUsers();
			}
		});
	});

}());