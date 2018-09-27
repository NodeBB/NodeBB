'use strict';


define('admin/manage/users', ['translator', 'benchpress'], function (translator, Benchpress) {
	var Users = {};

	Users.init = function () {
		var navPills = $('.nav-pills li');
		var pathname = window.location.pathname;
		if (!navPills.find('a[href="' + pathname + '"]').length) {
			pathname = config.relative_path + '/admin/manage/users/latest';
		}
		navPills.removeClass('active').find('a[href="' + pathname + '"]').parent().addClass('active');

		function getSelectedUids() {
			var uids = [];

			$('.users-table [component="user/select/single"]').each(function () {
				if ($(this).is(':checked')) {
					uids.push($(this).attr('data-uid'));
				}
			});

			return uids;
		}

		function update(className, state) {
			$('.users-table [component="user/select/single"]:checked').parents('.user-row').find(className).each(function () {
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
			return function (err) {
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

		$('[component="user/select/all"]').on('click', function () {
			if ($(this).is(':checked')) {
				$('.users-table [component="user/select/single"]').prop('checked', true);
			} else {
				$('.users-table [component="user/select/single"]').prop('checked', false);
			}
		});

		$('.ban-user').on('click', function () {
			var uids = getSelectedUids();
			if (!uids.length) {
				app.alertError('[[error:no-users-selected]]');
				return false;	// specifically to keep the menu open
			}

			bootbox.confirm((uids.length > 1 ? '[[admin/manage/users:alerts.confirm-ban-multi]]' : '[[admin/manage/users:alerts.confirm-ban]]'), function (confirm) {
				if (confirm) {
					socket.emit('user.banUsers', { uids: uids, reason: '' }, done('[[admin/manage/users:alerts.ban-success]]', '.ban', true));
				}
			});
		});

		$('.ban-user-temporary').on('click', function () {
			var uids = getSelectedUids();
			if (!uids.length) {
				app.alertError('[[error:no-users-selected]]');
				return false;	// specifically to keep the menu open
			}

			Benchpress.parse('admin/partials/temporary-ban', {}, function (html) {
				bootbox.dialog({
					className: 'ban-modal',
					title: '[[user:ban_account]]',
					message: html,
					show: true,
					buttons: {
						close: {
							label: '[[global:close]]',
							className: 'btn-link',
						},
						submit: {
							label: '[[admin/manage/users:alerts.button-ban-x, ' + uids.length + ']]',
							callback: function () {
								var formData = $('.ban-modal form').serializeArray().reduce(function (data, cur) {
									data[cur.name] = cur.value;
									return data;
								}, {});
								var until = formData.length > 0 ? (Date.now() + (formData.length * 1000 * 60 * 60 * (parseInt(formData.unit, 10) ? 24 : 1))) : 0;
								socket.emit('user.banUsers', { uids: uids, until: until, reason: formData.reason }, done('[[admin/manage/users:alerts.ban-success]]', '.ban', true));
							},
						},
					},
				});
			});
		});

		$('.unban-user').on('click', function () {
			var uids = getSelectedUids();
			if (!uids.length) {
				app.alertError('[[error:no-users-selected]]');
				return false;	// specifically to keep the menu open
			}

			socket.emit('user.unbanUsers', uids, done('[[admin/manage/users:alerts.unban-success]]', '.ban', false));
		});

		$('.reset-lockout').on('click', function () {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			socket.emit('admin.user.resetLockouts', uids, done('[[admin/manage/users:alerts.lockout-reset-success]]'));
		});

		$('.validate-email').on('click', function () {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			bootbox.confirm('[[admin/manage/users:alerts.confirm-validate-email]]', function (confirm) {
				if (!confirm) {
					return;
				}
				socket.emit('admin.user.validateEmail', uids, function (err) {
					if (err) {
						return app.alertError(err.message);
					}
					app.alertSuccess('[[admin/manage/users:alerts.validate-email-success]]');
					update('.notvalidated', false);
					update('.validated', true);
					unselectAll();
				});
			});
		});

		$('.send-validation-email').on('click', function () {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}
			socket.emit('admin.user.sendValidationEmail', uids, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alertSuccess('[[notifications:email-confirm-sent]]');
			});
		});

		$('.password-reset-email').on('click', function () {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			bootbox.confirm('[[admin/manage/users:alerts.password-reset-confirm]]', function (confirm) {
				if (confirm) {
					socket.emit('admin.user.sendPasswordResetEmail', uids, done('[[notifications:email-confirm-sent]]'));
				}
			});
		});

		$('.delete-user').on('click', function () {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			bootbox.confirm('[[admin/manage/users:alerts.confirm-delete]]', function (confirm) {
				if (confirm) {
					socket.emit('admin.user.deleteUsers', uids, function (err) {
						if (err) {
							return app.alertError(err.message);
						}

						app.alertSuccess('[[admin/manage/users:alerts.delete-success]]');
						removeSelected();
						unselectAll();
						if (!$('.users-table [component="user/select/single"]').length) {
							ajaxify.refresh();
						}
					});
				}
			});
		});

		$('.delete-user-and-content').on('click', function () {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}
			bootbox.confirm('[[admin/manage/users:alerts.confirm-purge]]', function (confirm) {
				if (confirm) {
					socket.emit('admin.user.deleteUsersAndContent', uids, function (err) {
						if (err) {
							return app.alertError(err.message);
						}

						app.alertSuccess('[[admin/manage/users:alerts.delete-success]]');
						removeSelected();
						unselectAll();
						if (!$('.users-table [component="user/select/single"]').length) {
							ajaxify.refresh();
						}
					});
				}
			});
		});

		function handleUserCreate() {
			$('#createUser').on('click', function () {
				Benchpress.parse('admin/partials/create_user_modal', {}, function (html) {
					bootbox.dialog({
						message: html,
						title: '[[admin/manage/users:alerts.create]]',
						onEscape: true,
						buttons: {
							cancel: {
								label: '[[admin/manage/users:alerts.button-cancel]]',
								className: 'btn-link',
							},
							create: {
								label: '[[admin/manage/users:alerts.button-create]]',
								className: 'btn-primary',
								callback: function () {
									createUser.call(this);
									return false;
								},
							},
						},
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
				return errorEl.translateHtml('[[admin/manage/users:alerts.error-x, [[admin/manage/users:alerts.error-passwords-different]]]]').removeClass('hide');
			}

			var user = {
				username: username,
				email: email,
				password: password,
			};

			socket.emit('admin.user.createUser', user, function (err) {
				if (err) {
					return errorEl.translateHtml('[[admin/manage/users:alerts.error-x, ' + err.message + ']]').removeClass('hide');
				}

				modal.modal('hide');
				modal.on('hidden.bs.modal', function () {
					ajaxify.refresh();
				});
				app.alertSuccess('[[admin/manage/users:alerts.create-success]]');
			});
		}

		var timeoutId = 0;

		$('#search-user-uid, #search-user-name, #search-user-email, #search-user-ip').on('keyup', function () {
			if (timeoutId !== 0) {
				clearTimeout(timeoutId);
				timeoutId = 0;
			}

			var $this = $(this);
			var type = $this.attr('data-search-type');

			timeoutId = setTimeout(function () {
				$('.fa-spinner').removeClass('hidden');

				socket.emit('admin.user.search', { searchBy: type, query: $this.val() }, function (err, data) {
					if (err) {
						return app.alertError(err.message);
					}

					Benchpress.parse('admin/manage/users', 'users', data, function (html) {
						translator.translate(html, function (html) {
							html = $(html);
							$('.users-table tr').not(':first').remove();
							$('.users-table tr').first().after(html);
							html.find('.timeago').timeago();
							$('.fa-spinner').addClass('hidden');

							if (data && data.users.length === 0) {
								$('#user-notfound-notify').translateHtml('[[admin/manage/users:search.not-found]]')
									.removeClass('hide')
									.addClass('label-danger')
									.removeClass('label-success');
							} else {
								$('#user-notfound-notify').translateHtml(translator.compile('admin/manage/users:alerts.x-users-found', data.users.length, data.timing))
									.removeClass('hide')
									.addClass('label-success')
									.removeClass('label-danger');
							}
						});
					});
				});
			}, 250);
		});

		handleUserCreate();

		handleInvite();
	};

	function handleInvite() {
		$('[component="user/invite"]').on('click', function () {
			bootbox.prompt('[[admin/manage/users:alerts.prompt-email]]', function (email) {
				if (!email) {
					return;
				}

				socket.emit('user.invite', email, function (err) {
					if (err) {
						return app.alertError(err.message);
					}
					app.alertSuccess('[[admin/manage/users:alerts.email-sent-to, ' + email + ']]');
				});
			});
		});
	}


	return Users;
});
