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

		function updateUserBanButtons(elements) {
			elements.each(function(index, element) {
				var banBtn = $(element);
				var uid = getUID(banBtn);
				if (isUserAdmin(banBtn) || uid === yourid) {
					banBtn.addClass('disabled');
				} else if (isUserBanned(banBtn)) {
					banBtn.addClass('btn-warning');
				} else if (!isUserAdmin(banBtn)) {
					banBtn.removeClass('disabled');
				} else {
					banBtn.removeClass('btn-warning');
				}
			});
		}

		function updateUserAdminButtons(elements) {
			elements.each(function(index, element) {
				var adminBtn = $(element);
				var uid = getUID(adminBtn);
				if (isUserAdmin(adminBtn)) {
					adminBtn.attr('value', 'UnMake Admin').html('Remove Admin');
					if (uid === yourid) {
						adminBtn.addClass('disabled');
					}
				} else if (isUserBanned(adminBtn)) {
					adminBtn.addClass('disabled');
				} else if (!isUserBanned(adminBtn)) {
					adminBtn.removeClass('disabled');
				} else {
					adminBtn.removeClass('btn-warning');
				}
			});
		}

		function updateButtons() {
			updateUserBanButtons($('.ban-btn'));
			updateUserAdminButtons($('.admin-btn'));
		}

		$('#users-container').on('click', '.ban-btn', function() {
			var banBtn = $(this);
			var parent = banBtn.parents('.users-box');
			var uid = getUID(banBtn);

			if (!isUserAdmin(banBtn)) {
				if (isUserBanned(banBtn)) {
					socket.emit('admin.user.unbanUser', uid);
					banBtn.removeClass('btn-warning');
					parent.attr('data-banned', 0);
					updateUserAdminButtons($('.admin-btn'));
				} else {
					bootbox.confirm('Do you really want to ban "' + parent.attr('data-username') + '"?', function(confirm) {
						if (confirm) {
							socket.emit('admin.user.banUser', uid);
							banBtn.addClass('btn-warning');
							parent.attr('data-banned', 1);
							updateUserAdminButtons($('.admin-btn'));
						}
					});
				}
			}

			return false;
		});

		$('#users-container').on('click', '.admin-btn', function() {
			var adminBtn = $(this);
			var parent = adminBtn.parents('.users-box');
			var uid = getUID(adminBtn);

			if(uid === yourid) {
				app.alert({
					title: 'Error',
					message: 'You can\'t remove yourself as Administrator!',
					type: 'danger',
					timeout: 5000
				});
			} else if (!isUserAdmin(adminBtn)) {
				socket.emit('admin.user.makeAdmin', uid);
				adminBtn.attr('value', 'UnMake Admin').html('Remove Admin');
				parent.attr('data-admin', 1);
				updateUserBanButtons($('.ban-btn'));

			} else if(uid !== yourid) {
				bootbox.confirm('Do you really want to remove this user as admin "' + parent.attr('data-username') + '"?', function(confirm) {
					if (confirm) {
						socket.emit('admin.user.removeAdmin', uid);
						adminBtn.attr('value', 'Make Admin').html('Make Admin');
						parent.attr('data-admin', 0);
						updateUserBanButtons($('.ban-btn'));
					}
				});
			}
			return false;
		});

		function handleUserCreate() {
			var errorEl = $('#create-modal-error');
			$('#createUser').on('click', function() {
				$('#create-modal').modal('show');
				$('#create-modal form')[0].reset();
				errorEl.addClass('hide');
			});

			$('#create-modal-go').on('click', function() {
				var username = $('#create-user-name').val(),
					email = $('#create-user-email').val(),
					password = $('#create-user-password').val(),
					passwordAgain = $('#create-user-password-again').val();


				if(password !== passwordAgain) {
					return errorEl.html('<strong>Error</strong><p>Passwords must match!</p>').removeClass('hide');
				}

				var user = {
					username: username,
					email: email,
					password: password
				};

				socket.emit('admin.user.createUser', user, function(err) {
					if(err) {
						return errorEl.html('<strong>Error</strong><p>' + err.message + '</p>').removeClass('hide');
					}
					$('#create-modal').modal('hide');
					$('#create-modal').on('hidden.bs.modal', function() {
						ajaxify.go('admin/users');
					});
					app.alertSuccess('User created!');
				});

			});
		}


		$('document').ready(function() {

			var timeoutId = 0,
				loadingMoreUsers = false;

			var url = window.location.href,
				parts = url.split('/'),
				active = parts[parts.length - 1];

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

					$('.fa-spinner').removeClass('none');

					socket.emit('admin.user.search', username, function(err, data) {
						if(err) {
							return app.alertError(err.message);
						}

						var html = templates.prepare(templates['admin/users'].blocks['users']).parse({
							users: data.users
						}),
							userListEl = document.querySelector('.users');

						userListEl.innerHTML = html;
						$('.fa-spinner').addClass('none');

						if (data && data.users.length === 0) {
							$('#user-notfound-notify').html('User not found!')
								.show()
								.addClass('label-danger')
								.removeClass('label-success');
						} else {
							$('#user-notfound-notify').html(data.users.length + ' user' + (data.users.length > 1 ? 's' : '') + ' found! Search took ' + data.timing + ' ms.')
								.show()
								.addClass('label-success')
								.removeClass('label-danger');
						}

						updateButtons();
					});
				}, 250);
			});

			updateButtons();

			handleUserCreate();

			function onUsersLoaded(users) {
				var html = templates.prepare(templates['admin/users'].blocks['users']).parse({
					users: users
				});
				html = $(html);
				$('#users-container').append(html);

				updateUserBanButtons(html.find('.ban-btn'));
				updateUserAdminButtons(html.find('.admin-btn'));
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
					socket.emit('user.loadMore', {
						set: set,
						after: $('#users-container').children().length
					}, function(err, data) {
						if (data && data.users.length) {
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