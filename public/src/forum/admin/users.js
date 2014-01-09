define(function() {
	var Users = {};

	Users.init = function() {
		var yourid = templates.get('yourid');

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

		function updateUserBanButtons() {
			jQuery('.ban-btn').each(function(index, element) {
				var banBtn = $(element);
				var uid = getUID(banBtn);
				if (isUserAdmin(banBtn) || uid === yourid)
					banBtn.addClass('disabled');
				else if (isUserBanned(banBtn))
					banBtn.addClass('btn-warning');
				else if (!isUserAdmin(banBtn))
					banBtn.removeClass('disabled');
				else
					banBtn.removeClass('btn-warning');
					updateUserAdminButtons();
			});
		}

		function updateUserAdminButtons() {
			jQuery('.admin-btn').each(function(index, element) {
				var adminBtn = $(element);
				var uid = getUID(adminBtn);
				if (isUserAdmin(adminBtn)) {
					adminBtn.attr('value', 'UnMake Admin').html('Remove Admin');
					if (uid === yourid) {
						adminBtn.addClass('disabled');
					}
				}
				else if (isUserBanned(adminBtn))
					adminBtn.addClass('disabled');
				else if (!isUserBanned(adminBtn))
					adminBtn.removeClass('disabled');
				else
					adminBtn.removeClass('btn-warning');

			});
		}

		function initUsers() {
			updateUserBanButtons();
			updateUserAdminButtons();

			$('#users-container').on('click', '.ban-btn', function() {
				var banBtn = $(this);
				var isAdmin = isUserAdmin(banBtn);
				var isBanned = isUserBanned(banBtn);
				var parent = banBtn.parents('.users-box');
				var uid = getUID(banBtn);

				if (!isAdmin) {
					if (isBanned) {
						socket.emit('api:admin.user.unbanUser', uid);
						banBtn.removeClass('btn-warning');
						parent.attr('data-banned', 0);
						updateUserAdminButtons();
					} else {
						bootbox.confirm('Do you really want to ban "' + parent.attr('data-username') + '"?', function(confirm) {
							if (confirm) {
								socket.emit('api:admin.user.banUser', uid);
								banBtn.addClass('btn-warning');
								parent.attr('data-banned', 1);
								updateUserAdminButtons();
							}
						});
					}
				}

				return false;
			});

			$('#users-container').on('click', '.admin-btn', function() {
				var adminBtn = $(this);
				var isAdmin = isUserAdmin(adminBtn);
				var parent = adminBtn.parents('.users-box');
				var isBanned = isUserBanned(adminBtn);
				var uid = getUID(adminBtn);

				    if(uid === yourid){
						app.alert({
							title: 'Error',
							message: 'You can\'t remove yourself as Administrator!',
							type: 'danger',
							timeout: 5000
						});
				    }
					else if (!isAdmin) {
						socket.emit('api:admin.user.makeAdmin', uid);
						adminBtn.attr('value', 'UnMake Admin').html('Remove Admin');
						parent.attr('data-admin', 1);
						updateUserBanButtons();

					} else if(uid !== yourid) {
						bootbox.confirm('Do you really want to remove this user as admin "' + parent.attr('data-username') + '"?', function(confirm) {
							if (confirm) {
								socket.emit('api:admin.user.removeAdmin', uid);
								adminBtn.attr('value', 'Make Admin').html('Make Admin');
								parent.attr('data-admin', 0);
								updateUserBanButtons();

							}
						});
					}


				return false;
			});
		}

		function handleUserCreate() {
			$('#createUser').on('click', function() {
				$('#create-modal').modal('show');
			});

			$('#create-modal-go').on('click', function() {
				var username = $('#create-user-name').val(),
					email = $('#create-user-email').val(),
					password = $('#create-user-password').val(),
					passwordAgain = $('#create-user-password-again').val(),
					errorEl = $('#create-modal-error');

				if(password !== passwordAgain) {
					return errorEl.html('<strong>Error</strong><p>Passwords must match!</p>').removeClass('hide');
				}

				var user = {
					username: username,
					email: email,
					password: password
				};

				socket.emit('api:admin.user.createUser', user, function(err, data) {
					if(err) {
						return errorEl.html('<strong>Error</strong><p>' + err + '</p>').removeClass('hide');
					}
					$('#create-modal').modal('hide');
					app.alertSuccess('User created!');
					ajaxify.go('admin/users');
				});

			});
		}


		jQuery('document').ready(function() {

			var timeoutId = 0,
				loadingMoreUsers = false;

			var url = window.location.href,
				parts = url.split('/'),
				active = parts[parts.length - 1];

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

					jQuery('.fa-spinner').removeClass('none');

					socket.emit('api:admin.user.search', username, function(err, data) {
						console.log(data);
						if(err) {
							return app.alertError(err.message);
						}

						var html = templates.prepare(templates['admin/users'].blocks['users']).parse({
							users: data
						}),
							userListEl = document.querySelector('.users');

						userListEl.innerHTML = html;
						jQuery('.fa-spinner').addClass('none');

						if (data && data.length === 0) {
							$('#user-notfound-notify').html('User not found!')
								.show()
								.addClass('label-danger')
								.removeClass('label-success');
						} else {
							$('#user-notfound-notify').html(data.length + ' user' + (data.length > 1 ? 's' : '') + ' found!')
								.show()
								.addClass('label-success')
								.removeClass('label-danger');
						}

						initUsers();
					});
				}, 250);
			});

			initUsers();

			handleUserCreate();

			function onUsersLoaded(users) {
				var html = templates.prepare(templates['admin/users'].blocks['users']).parse({
					users: users
				});
				$('#users-container').append(html);
				updateUserButtons();
			}

			function loadMoreUsers() {
				var set = '';
				if (active === 'latest') {
					set = 'users:joindate';
				} else if (active === 'sort-posts') {
					set = 'users:postcount';
				} else if (active === 'sort-reputation') {
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
	};

	return Users;
});