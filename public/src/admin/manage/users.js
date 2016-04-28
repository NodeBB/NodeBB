"use strict";

/* global socket, define, templates, bootbox, app, ajaxify  */

define('admin/manage/users', ['admin/modules/selectable'], function(selectable) {
	var Users = {};

	Users.init = function() {
		selectable.enable('#users-container', '.user-selectable');

		function getSelectedUids() {
			var uids = [];
			$('#users-container .users-box .selected').each(function() {
				uids.push($(this).parents('[data-uid]').attr('data-uid'));
			});

			return uids;
		}

		function update(className, state) {
			$('#users-container .users-box .selected').siblings('.labels').find(className).each(function() {
				$(this).toggleClass('hide', !state);
			});
		}

		function unselectAll() {
			$('#users-container .users-box .selected').removeClass('selected');
		}

		function removeSelected() {
			$('#users-container .users-box .selected').parents('.users-box').remove();
		}

		function done(successMessage, className, flag) {
			return function(err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alertSuccess(successMessage);
				if (className) {
					update(className, flag);
				}
				unselectAll();
			};
		}

		$('.ban-user').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				return false;
			}

			bootbox.confirm('Do you really want to ban?', function(confirm) {
				if (confirm) {
					socket.emit('user.banUsers', uids, done('User(s) banned!', '.ban', true));
				}
			});
			return false;
		});

		$('.unban-user').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			socket.emit('user.unbanUsers', uids, done('User(s) unbanned!', '.ban', false));
			return false;
		});

		$('.reset-lockout').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			socket.emit('admin.user.resetLockouts', uids, done('Lockout(s) reset!'));
			return false;
		});

		$('.reset-flags').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			socket.emit('admin.user.resetFlags', uids, done('Flags(s) reset!'));
			return false;
		});

		$('.admin-user').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			if (uids.indexOf(app.user.uid.toString()) !== -1) {
				app.alertError('You can\'t remove yourself as Administrator!');
			} else {
				socket.emit('admin.user.makeAdmins', uids, done('User(s) are now administrators.', '.administrator', true));
			}
			return false;
		});

		$('.remove-admin-user').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			if (uids.indexOf(app.user.uid.toString()) !== -1) {
				app.alertError('You can\'t remove yourself as Administrator!');
			} else {
				bootbox.confirm('Do you really want to remove admins?', function(confirm) {
					if (confirm) {
						socket.emit('admin.user.removeAdmins', uids, done('User(s) are no longer administrators.', '.administrator', false));
					}
				});
			}
			return false;
		});

		$('.validate-email').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			bootbox.confirm('Do you want to validate email(s) of these user(s)?', function(confirm) {
				if (confirm) {
					socket.emit('admin.user.validateEmail', uids, done('Emails validated', '.notvalidated', false));
				}
			});
			return false;
		});

		$('.send-validation-email').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}
			socket.emit('admin.user.sendValidationEmail', uids, function(err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alertSuccess('[[notifications:email-confirm-sent]]');
			});
		});

		$('.password-reset-email').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			bootbox.confirm('Do you want to send password reset email(s) to these user(s)?', function(confirm) {
				if (confirm) {
					socket.emit('admin.user.sendPasswordResetEmail', uids, done('Emails sent'));
				}
			});
			return false;
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


				if (password !== passwordAgain) {
					return errorEl.html('<strong>Error</strong><p>Passwords must match!</p>').removeClass('hide');
				}

				var user = {
					username: username,
					email: email,
					password: password
				};

				socket.emit('admin.user.createUser', user, function(err) {
					if(err) {
						return errorEl.translateHtml('<strong>Error</strong><p>' + err.message + '</p>').removeClass('hide');
					}
					$('#create-modal').modal('hide');
					$('#create-modal').on('hidden.bs.modal', function() {
						ajaxify.refresh();
					});
					app.alertSuccess('User created!');
				});

			});
		}

		var timeoutId = 0;

		$('.nav-pills li').removeClass('active').find('a[href="' + window.location.pathname + '"]').parent().addClass('active');

		$('#search-user-name, #search-user-email, #search-user-ip').on('keyup', function() {
			if (timeoutId !== 0) {
				clearTimeout(timeoutId);
				timeoutId = 0;
			}

			var $this = $(this);
			var type =  $this.attr('data-search-type');

			timeoutId = setTimeout(function() {
				$('.fa-spinner').removeClass('hidden');

				socket.emit('admin.user.search', {searchBy: type, query: $this.val()}, function(err, data) {
					if (err) {
						return app.alertError(err.message);
					}

					templates.parse('admin/manage/users', 'users', data, function(html) {
						$('#users-container').html(html);

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

						selectable.enable('#users-container', '.user-selectable');
					});
				});
			}, 250);
		});

		handleUserCreate();

		handleInvite();

	};

	function handleInvite() {
		$('[component="user/invite"]').on('click', function() {
			bootbox.prompt('Email: ', function(email) {
				if (!email) {
					return;
				}

				socket.emit('user.invite', email, function(err) {
					if (err) {
						return app.alertError(err.message);
					}
					app.alertSuccess('An invitation email has been sent to ' + email);
				});
			});
		});
	}


	return Users;
});
