'use strict';

define('admin/manage/users', ['translator', 'benchpress', 'autocomplete'], function (translator, Benchpress, autocomplete) {
	var Users = {};

	Users.init = function () {
		var navPills = $('.nav-pills li');
		var pathname = window.location.pathname;
		if (!navPills.find('a[href^="' + pathname + '"]').length || pathname === config.relative_path + '/admin/manage/users') {
			pathname = config.relative_path + '/admin/manage/users/latest';
		}
		navPills.removeClass('active').find('a[href^="' + pathname + '"]').parent().addClass('active');

		$('#results-per-page').val(ajaxify.data.resultsPerPage).on('change', function () {
			var query = utils.params();
			query.resultsPerPage = $('#results-per-page').val();
			ajaxify.go(window.location.pathname + '?' + $.param(query));
		});

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
			$('.users-table [component="user/select/single"]').prop('checked', $(this).is(':checked'));
		});

		$('.manage-groups').on('click', function () {
			var uids = getSelectedUids();
			if (!uids.length) {
				app.alertError('[[error:no-users-selected]]');
				return false;
			}
			socket.emit('admin.user.loadGroups', uids, function (err, data) {
				if (err) {
					return app.alertError(err);
				}
				Benchpress.parse('admin/partials/manage_user_groups', data, function (html) {
					var modal = bootbox.dialog({
						message: html,
						title: '[[admin/manage/users:manage-groups]]',
						onEscape: true,
					});
					modal.on('shown.bs.modal', function () {
						autocomplete.group(modal.find('.group-search'), function (ev, ui) {
							var uid = $(ev.target).attr('data-uid');
							socket.emit('admin.groups.join', { uid: uid, groupName: ui.item.value }, function (err) {
								if (err) {
									return app.alertError(err);
								}
								ui.item.group.nameEscaped = translator.escape(ui.item.group.displayName);
								app.parseAndTranslate('admin/partials/manage_user_groups', { users: [{ groups: [ui.item.group] }] }, function (html) {
									$('[data-uid=' + uid + '] .group-area').append(html.find('.group-area').html());
								});
							});
						});
					});
					modal.on('click', '.group-area a', function () {
						modal.modal('hide');
					});
					modal.on('click', '.remove-group-icon', function () {
						var groupCard = $(this).parents('[data-group-name]');
						var groupName = groupCard.attr('data-group-name');
						var uid = $(this).parents('[data-uid]').attr('data-uid');
						socket.emit('admin.groups.leave', { uid: uid, groupName: groupName }, function (err) {
							if (err) {
								return app.alertError(err);
							}
							groupCard.remove();
						});
						return false;
					});
				});
			});
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

		$('.force-password-reset').on('click', function () {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			bootbox.confirm('[[admin/manage/users:alerts.confirm-force-password-reset]]', function (confirm) {
				if (confirm) {
					socket.emit('admin.user.forcePasswordReset', uids, done('[[admin/manage/users:alerts.validate-force-password-reset-success]]'));
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

		$('.delete-user-content').on('click', function () {
			var uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			bootbox.confirm('[[admin/manage/users:alerts.confirm-delete-content]]', function (confirm) {
				if (confirm) {
					socket.emit('admin.user.deleteUsersContent', uids, function (err) {
						if (err) {
							return app.alertError(err.message);
						}

						app.alertSuccess('[[admin/manage/users:alerts.delete-content-success]]');
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
				return false;
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
				loadSearchPage({
					searchBy: type,
					query: $this.val(),
					page: 1,
				});
			}, 250);
		});

		handleUserCreate();

		handleInvite();
	};

	function loadSearchPage(query) {
		var qs = decodeURIComponent($.param(query));
		$.get(config.relative_path + '/api/admin/manage/users/search?' + qs, renderSearchResults).fail(function (xhrErr) {
			if (xhrErr && xhrErr.responseJSON && xhrErr.responseJSON.error) {
				app.alertError(xhrErr.responseJSON.error);
			}
		});
	}

	function renderSearchResults(data) {
		Benchpress.parse('partials/paginator', { pagination: data.pagination }, function (html) {
			$('.pagination-container').replaceWith(html);
		});

		app.parseAndTranslate('admin/manage/users', 'users', data, function (html) {
			$('.users-table tbody tr').remove();
			$('.users-table tbody').append(html);
			html.find('.timeago').timeago();
			$('.fa-spinner').addClass('hidden');

			if (data && data.users.length === 0) {
				$('#user-notfound-notify').translateHtml('[[admin/manage/users:search.not-found]]')
					.removeClass('hidden');
				$('#user-found-notify').addClass('hidden');
			} else {
				$('#user-found-notify').translateHtml(translator.compile('admin/manage/users:alerts.x-users-found', data.matchCount, data.timing))
					.removeClass('hidden');
				$('#user-notfound-notify').addClass('hidden');
			}
		});
	}

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
			return false;
		});
	}


	return Users;
});
