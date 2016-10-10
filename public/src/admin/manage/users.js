"use strict";

/* global config, socket, define, templates, bootbox, app, ajaxify  */

define('admin/manage/users', ['translator'], function(translator) {
	var Users = {};

	Users.init = function() {
		var navPills = $('.nav-pills li');
		var pathname = window.location.pathname;
		if (!navPills.find('a[href="' + pathname + '"]').length) {
			pathname = config.relative_path + '/admin/manage/users/latest';
		}
		navPills.removeClass('active').find('a[href="' + pathname + '"]').parent().addClass('active');

		function getSelectedUids() {
			var uids = [];

			$('.users-table [component="user/select/single"]').each(function() {
				if ($(this).is(':checked')) {
					uids.push($(this).attr('data-uid'));
				}
			});

			return uids;
		}

		function update(className, state) {
			$('.users-table [component="user/select/single"]:checked').parents('.user-row').find(className).each(function() {
				$(this).toggleClass('hidden', !state);
			});
		}

		function unselectAll() {
			$('.users-table [component="user/select/single"]').prop('checked', false);
			$('.users-table [component="user/select/all"]').prop('checked', false);
		}

		function removeSelected() {
			$('.users-table [component="user/select/single"]:checked').parents('.user-row').remove();
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

		$('[component="user/select/all"]').on('click', function() {
			if ($(this).is(':checked')) {
				$('.users-table [component="user/select/single"]').prop('checked', true);
			} else {
				$('.users-table [component="user/select/single"]').prop('checked', false);
			}
		});

		$('.ban-user').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				app.alertError('[[error:no-users-selected]]');
				return false;	// specifically to keep the menu open
			}

			bootbox.confirm('Do you really want to ban ' + (uids.length > 1 ? 'these users' : 'this user') + ' <strong>permanently</strong>?', function(confirm) {
				if (confirm) {
					socket.emit('user.banUsers', { uids: uids, reason: '' }, done('User(s) banned!', '.ban', true));
				}
			});
		});

		$('.ban-user-temporary').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				app.alertError('[[error:no-users-selected]]');
				return false;	// specifically to keep the menu open
			}

			templates.parse('admin/partials/temporary-ban', {}, function(html) {
				bootbox.dialog({
					className: 'ban-modal',
					title: '[[user:ban_account]]',
					message: html,
					show: true,
					buttons: {
						close: {
							label: '[[global:close]]',
							className: 'btn-link'
						},
						submit: {
							label: 'Ban ' + uids.length + (uids.length > 1 ? ' users' : ' user'),
							callback: function() {
								var formData = $('.ban-modal form').serializeArray().reduce(function(data, cur) {
									data[cur.name] = cur.value;
									return data;
								}, {});
								var until = formData.length ? (Date.now() + formData.length * 1000*60*60 * (parseInt(formData.unit, 10) ? 24 : 1)) : 0;
								socket.emit('user.banUsers', { uids: uids, until: until, reason: formData.reason }, done('User(s) banned!', '.ban', true));
							}
						}
					}
				});
			});
		});

		$('.unban-user').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				app.alertError('[[error:no-users-selected]]');
				return false;	// specifically to keep the menu open
			}

			socket.emit('user.unbanUsers', uids, done('User(s) unbanned!', '.ban', false));
		});

		$('.reset-lockout').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			socket.emit('admin.user.resetLockouts', uids, done('Lockout(s) reset!'));
		});

		$('.reset-flags').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			socket.emit('admin.user.resetFlags', uids, done('Flags(s) reset!'));
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
		});

		$('.validate-email').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			bootbox.confirm('Do you want to validate email(s) of these user(s)?', function(confirm) {
				if (!confirm) {
					return;
				}
				socket.emit('admin.user.validateEmail', uids, function(err) {
					if (err) {
						return app.alertError(err.message);
					}
					app.alertSuccess('Emails validated');
					update('.notvalidated', false);
					update('.validated', true);
					unselectAll();
				});
			});
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
		});

		$('.delete-user').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			bootbox.confirm('<b>Warning!</b><br/>Do you really want to delete user(s)?<br/> This action is not reversable, only the user account will be deleted, their posts and topics will not be deleled!', function(confirm) {
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

		$('.delete-user-and-content').on('click', function() {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}
			bootbox.confirm('<b>Warning!</b><br/>Do you really want to delete user(s) and their content?<br/> This action is not reversable, all user data and content will be erased!', function(confirm) {
				if (confirm) {
					socket.emit('admin.user.deleteUsersAndContent', uids, function(err) {
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
			$('#createUser').on('click', function() {
				templates.parse('admin/partials/create_user_modal', {}, function(html) {
					translator.translate(html, function(html) {
						bootbox.dialog({
							message: html,
							title: 'Create User',
							onEscape: true,
							buttons: {
								cancel: {
									label: 'Cancel',
									className: 'btn-link'
								},
								create: {
									label: 'Create',
									className: 'btn-primary',
									callback: function() {
										createUser.call(this);
										return false;
									}
								}
							}
						});
					});
				});
			});
		}

		function createUser() {
			var modal = this;
			var username = document.getElementById('create-user-name').value;
			var email = document.getElementById('create-user-email').value;
			var password = document.getElementById('create-user-password').value;
			var passwordAgain = document.getElementById('create-user-password-again').value;

			var errorEl = $('#create-modal-error');

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

				modal.modal('hide');
				modal.on('hidden.bs.modal', function() {
					ajaxify.refresh();
				});
				app.alertSuccess('User created!');
			});
		}

		var timeoutId = 0;

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
						html = $(html);
						$('.users-table tr').not(':first').remove();
						$('.users-table tr').first().after(html);
						html.find('.timeago').timeago();
						$('.fa-spinner').addClass('hidden');

						if (data && data.users.length === 0) {
							$('#user-notfound-notify').html('User not found!')
								.removeClass('hide')
								.addClass('label-danger')
								.removeClass('label-success');
						} else {
							$('#user-notfound-notify').html(data.users.length + ' user' + (data.users.length > 1 ? 's' : '') + ' found! Search took ' + data.timing + ' ms.')
								.removeClass('hide')
								.addClass('label-success')
								.removeClass('label-danger');
						}


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
