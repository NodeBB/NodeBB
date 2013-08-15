(function() {
	
	$(document).ready(function() {
		var timeoutId = 0;
		var loadingMoreUsers = false;
		
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
		
		socket.removeAllListeners('api:admin.user.search');
		
		socket.on('api:admin.user.search', function(data) {
			
			jQuery('.icon-spinner').addClass('none');				
			
			if(data === null) {
				$('#user-notfound-notify').html('You need to be logged in to search!')
					.show()
					.addClass('label-important')
					.removeClass('label-success');
				return;
			}
			
			var html = templates.prepare(templates['users'].blocks['users']).parse({
					users: data
				}),
				userListEl = document.querySelector('.users');

			userListEl.innerHTML = html;


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

		});
		
		$('.reputation').each(function(index, element) {
			$(element).html(app.addCommas($(element).html()));
		});
		
		$('.postcount').each(function(index, element) {
			$(element).html(app.addCommas($(element).html()));
		});
		
		function onUsersLoaded(users) {
			var html = templates.prepare(templates['users'].blocks['users']).parse({ users: users });
			$('#users-container').append(html);
		}
		
		function loadMoreUsers() {
			var set = '';
			if(active === 'users-latest' || active === 'users') {
				set = 'users:joindate';
			} else if(active === 'users-sort-posts') {
				set = 'users:postcount';
			} else if(active === 'users-sort-reputation') {
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
					} else {
						$('#load-more-users-btn').addClass('disabled');
					}
					loadingMoreUsers = false;
				});
			}
		}
		
		$('#load-more-users-btn').on('click', loadMoreUsers);
		
		$(window).off('scroll').on('scroll', function() {
			var bottom = (document.body.offsetHeight - $(window).height()) * 0.9;

			if (document.body.scrollTop > bottom && !loadingMoreUsers) {
				loadMoreUsers();
			}
		});
	});

}());