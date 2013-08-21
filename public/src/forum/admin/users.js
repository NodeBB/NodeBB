
(function() {

	function initUsers() {

		function isUserAdmin(element) {
			var parent = $(element).parents('.users-box');
			return (parent.attr('data-admin') !== "0");
		}

		function isUserBanned(element) {
			var parent = $(element).parents('.users-box');
			return (parent.attr('data-banned') !== "" && parent.attr('data-banned') !== "0");	
		}

		function getUID(element) {
			var parent = $(element).parents('.users-box');
			return parent.attr('data-uid');	
		}

		jQuery('.admin-btn').each(function(index, element) {
			var adminBtn = $(element);
			var isAdmin = isUserAdmin(adminBtn);
			
			if(isAdmin)
				adminBtn.addClass('btn-success');
			else
				adminBtn.removeClass('btn-success');

		});

		jQuery('.delete-btn').each(function(index, element) {
			var deleteBtn = $(element);
			var isAdmin = isUserAdmin(deleteBtn);
			
			if(isAdmin)
				deleteBtn.addClass('disabled');
			else
				deleteBtn.show();
		});

		jQuery('.ban-btn').each(function(index, element) {
			var banBtn = $(element);
			var isAdmin = isUserAdmin(banBtn);
			var isBanned = isUserBanned(banBtn);
			
			if(isAdmin)
				banBtn.addClass('disabled');
			else if(isBanned)
				banBtn.addClass('btn-warning');
			else 
				banBtn.removeClass('btn-warning');

		});

		jQuery('.admin-btn').on('click', function() {
			var adminBtn = $(this);
			var isAdmin = isUserAdmin(adminBtn);
			var parent = adminBtn.parents('.users-box');
			var uid = getUID(adminBtn);

			if(isAdmin) {
				socket.emit('api:admin.user.removeAdmin', uid);		
				adminBtn.removeClass('btn-success');
				parent.find('.delete-btn').removeClass('disabled');
				parent.attr('data-admin', 0);
			}
			else {
				bootbox.confirm('Do you really want to make "' + parent.attr('data-username') +'" an admin?', function(confirm) {
					if(confirm) {
						socket.emit('api:admin.user.makeAdmin', uid);
						adminBtn.addClass('btn-success');
						parent.find('.delete-btn').addClass('disabled');
						parent.attr('data-admin', 1);
					}
				});
			}
			
			return false;
		});

		jQuery('.delete-btn').on('click', function() {
			var deleteBtn = $(this);
			var isAdmin = isUserAdmin(deleteBtn);
			var parent = deleteBtn.parents('.users-box');
			var uid = getUID(deleteBtn);

			if(!isAdmin) {
				bootbox.confirm('Do you really want to delete "' + parent.attr('data-username') +'"?', function(confirm) {
					socket.emit('api:admin.user.deleteUser', uid);		
				});
			}
			
			return false;
		});

		jQuery('.ban-btn').on('click', function() {
			var banBtn = $(this);
			var isAdmin = isUserAdmin(banBtn);
			var isBanned = isUserBanned(banBtn);
			var parent = banBtn.parents('.users-box');
			var uid = getUID(banBtn);

			if(!isAdmin) {
				if(isBanned) {
					socket.emit('api:admin.user.unbanUser', uid);
					banBtn.removeClass('btn-warning');
					parent.attr('data-banned', 0);
				} else {
					bootbox.confirm('Do you really want to ban "' + parent.attr('data-username') +'"?', function(confirm) {
						socket.emit('api:admin.user.banUser', uid);		
						banBtn.addClass('btn-warning');
						parent.attr('data-banned', 1);
					});
				}
			}
			
			return false;
		});
	}


	jQuery('document').ready(function() {

		var yourid = templates.get('yourid'),
			timeoutId = 0,
			loadingMoreUsers = false;

		var url = window.location.href,
			parts = url.split('/'),
			active = parts[parts.length-1];

		jQuery('.nav-pills li').removeClass('active');
		jQuery('.nav-pills li a').each(function() {
			if (this.getAttribute('href').match(active)) {
				jQuery(this.parentNode).addClass('active');
				return false;
			}
		});

		jQuery('#search-user').on('keyup', function () {
			if(timeoutId !== 0) {
				clearTimeout(timeoutId);
				timeoutId = 0;
			}

			timeoutId = setTimeout(function() {
				var username = $('#search-user').val();
				
				jQuery('.icon-spinner').removeClass('none');
				socket.emit('api:admin.user.search', username);
				
			}, 250);
		});
		
		initUsers();
		
		socket.removeAllListeners('api:admin.user.search');
		
		socket.on('api:admin.user.search', function(data) {
			var html = templates.prepare(templates['admin/users'].blocks['users']).parse({
					users: data
				}),
				userListEl = document.querySelector('.users');

			userListEl.innerHTML = html;
			jQuery('.icon-spinner').addClass('none');				

			if(data && data.length === 0) {
				$('#user-notfound-notify').html('User not found!')
					.show()
					.addClass('label-important')
					.removeClass('label-success');
			}
			else {
				$('#user-notfound-notify').html(data.length + ' user'+(data.length>1?'s':'') + ' found!')
					.show()
					.addClass('label-success')
					.removeClass('label-important');
			}
			
			initUsers();
		});
	
		function onUsersLoaded(users) {
			var html = templates.prepare(templates['admin/users'].blocks['users']).parse({ users: users });
			$('#users-container').append(html);
		}

		function loadMoreUsers() {
			var set = '';
			if(active === 'latest') {
				set = 'users:joindate';
			} else if(active === 'sort-posts') {
				set = 'users:postcount';
			} else if(active === 'sort-reputation') {
				set = 'users:reputation';
			}

			if(set) {
				loadingMoreUsers = true;
				socket.emit('api:users.loadMore', {
					set: set, 
					after: $('#users-container').children().length 
				}, function(data) {
					if(data.users.length) {
						onUsersLoaded(data.users);
					}
					loadingMoreUsers = false;
				});
			}
		}

		$('#load-more-users-btn').on('click', loadMoreUsers);

		$(window).off('scroll').on('scroll', function() {
			var bottom = (document.body.offsetHeight - $(window).height()) * 0.9;

			if ($(window).scrollTop() > bottom && !loadingMoreUsers) {
				loadMoreUsers();
			}
		});

	});

}());