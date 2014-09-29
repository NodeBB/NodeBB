"use strict";
/* global socket, define, templates, bootbox, app, ajaxify,  */
define('forum/admin/manage/users', function() {
	var Users = {};

	Users.init = function() {
		var yourid = ajaxify.variables.get('yourid');

		$('#users-container').on('click', '.select', function() {
			var userBox = $(this).parents('.users-box');
			var isSelected = userBox.hasClass('selected');
			userBox.toggleClass('selected', !isSelected);
			$(this).toggleClass('fa-square-o', isSelected).toggleClass('fa-check-square-o', !isSelected);
		});

		function getSelectedUids() {
			var uids = [];
			$('#users-container .users-box.selected').each(function() {
				uids.push($(this).attr('data-uid'));
			});
			return uids;
		}

		function update(className, state) {
			$('#users-container .users-box.selected ' + className +'.label').each(function() {
				$(this).toggleClass('hide', !state);
			});
		}

		function unselectAll() {
			$('#users-container .users-box.selected').removeClass('selected')
				.find('.select').toggleClass('fa-square-o', true).toggleClass('fa-check-square-o', false);
		}

		function removeSelected() {
			$('#users-container .users-box.selected').remove();
		}

		$('.ban-user').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			bootbox.confirm('Do you really want to ban?', function(confirm) {
				if (confirm) {
					socket.emit('admin.user.banUsers', uids, function(err) {
						if (err) {
							return app.alertError(err.message);
						}
						app.alertSuccess('User(s) banned!');
					});
					update('.ban', true);
					unselectAll();
				}
			});
		});

		$('.unban-user').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			socket.emit('admin.user.unbanUsers', uids, function(err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alertSuccess('User(s) unbanned!');
			});

			update('.ban', false);
			unselectAll();
		});

		$('.reset-lockout').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			socket.emit('admin.user.resetLockouts', uids, function(err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alertSuccess('Lockout(s) reset!');
			});

			unselectAll();
		});

		$('.admin-user').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			if (uids.indexOf(yourid) !== -1) {
				app.alertError('You can\'t remove yourself as Administrator!');
			} else {
				socket.emit('admin.user.makeAdmins', uids, function(err) {
					if (err) {
						return app.alertError(err.message);
					}
					app.alertSuccess('User(s) are now administrators.');
				});

				update('.administrator', true);
				unselectAll();
			}
		});

		$('.remove-admin-user').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			if (uids.indexOf(yourid.toString()) !== -1) {
				app.alertError('You can\'t remove yourself as Administrator!');
			} else {
				bootbox.confirm('Do you really want to remove admins?', function(confirm) {
					if (confirm) {
						socket.emit('admin.user.removeAdmins', uids, function(err) {
							if (err) {
								return app.alertError(err.message);
							}
							app.alertSuccess('User(s) are no longer administrators.');
						});

						update('.administrator', false);
						unselectAll();
					}
				});
			}
		});

		$('.delete-user').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			bootbox.confirm('<b>Warning!</b><br/>Do you really want to delete user(s)?<br/> This action is not reversable, all user data and content will be erased!', function(confirm) {
				if (confirm) {
					socket.emit('admin.user.deleteUsers', uids, function(err) {
						if (err) {
							return app.alertError(err.message);
						}

						app.alertSuccess('User(s) Deleted!');
						removeSelected();
						unselectAll();
					});
				}
			});
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

				$('.fa-spinner').removeClass('hidden');

				socket.emit('admin.user.search', username, function(err, data) {
					if(err) {
						return app.alertError(err.message);
					}

					ajaxify.loadTemplate('admin/manage/users', function(adminUsers) {
						$('.users').html(templates.parse(templates.getBlock(adminUsers, 'users'), data));

						$('.fa-spinner').addClass('hidden');

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
					});
				});
			}, 250);
		});

		handleUserCreate();

		function onUsersLoaded(users) {
			ajaxify.loadTemplate('admin/manage/users', function(adminUsers) {
				var html = $(templates.parse(templates.getBlock(adminUsers, 'users'), {users: users}));
				$('#users-container').append(html);
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


	};

	return Users;
});
