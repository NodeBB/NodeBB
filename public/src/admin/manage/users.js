'use strict';

define('admin/manage/users', [
	'translator', 'benchpress', 'autocomplete', 'api', 'slugify',
], function (translator, Benchpress, autocomplete, api, slugify) {
	var Users = {};

	Users.init = function () {
		$('#results-per-page').val(ajaxify.data.resultsPerPage).on('change', function () {
			var query = utils.params();
			query.resultsPerPage = $('#results-per-page').val();
			var qs = buildSearchQuery(query);
			ajaxify.go(window.location.pathname + '?' + qs);
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

		// use onSuccess/onFail instead
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

		function onSuccess(successMessage, className, flag) {
			app.alertSuccess(successMessage);
			if (className) {
				update(className, flag);
			}
			unselectAll();
		}

		function onFail(err) {
			app.alertError(err.message);
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
							api.put('/groups/' + ui.item.group.slug + '/membership/' + uid, undefined, () => {
								ui.item.group.nameEscaped = translator.escape(ui.item.group.displayName);
								app.parseAndTranslate('admin/partials/manage_user_groups', { users: [{ groups: [ui.item.group] }] }, function (html) {
									$('[data-uid=' + uid + '] .group-area').append(html.find('.group-area').html());
								});
							}, 'default');
						});
					});
					modal.on('click', '.group-area a', function () {
						modal.modal('hide');
					});
					modal.on('click', '.remove-group-icon', function () {
						var groupCard = $(this).parents('[data-group-name]');
						var groupName = groupCard.attr('data-group-name');
						var uid = $(this).parents('[data-uid]').attr('data-uid');
						api.del('/groups/' + slugify(groupName) + '/membership/' + uid, undefined, () => {
							groupCard.remove();
						}, 'default');
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
					var requests = uids.map(function (uid) {
						return api.put('/users/' + uid + '/ban');
					});

					$.when(requests)
						.done(function () {
							onSuccess('[[admin/manage/users:alerts.ban-success]]', '.ban', true);
						})
						.fail(function (ev) {
							onFail(ev.responseJSON.status);
						});
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

								var requests = uids.map(function (uid) {
									return api.put('/users/' + uid + '/ban', {
										until: until,
										reason: formData.reason,
									});
								});

								$.when(requests)
									.done(function () {
										onSuccess('[[admin/manage/users:alerts.ban-success]]', '.ban', true);
									}).fail(function (ev) {
										onFail(ev.responseJSON.status);
									});
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

			var requests = uids.map(function (uid) {
				return api.delete('/users/' + uid + '/ban');
			});

			$.when(requests)
				.done(function () {
					onSuccess('[[admin/manage/users:alerts.unban-success]]', '.ban', false);
				}).fail(function (ev) {
					onFail(ev.responseJSON.status);
				});
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
			$('[data-action="create"]').on('click', function () {
				Benchpress.parse('admin/partials/create_user_modal', {}, function (html) {
					var modal = bootbox.dialog({
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
					modal.on('shown.bs.modal', function () {
						modal.find('#create-user-name').focus();
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

			api.post('/users', user, () => {
				modal.modal('hide');
				modal.on('hidden.bs.modal', function () {
					ajaxify.refresh();
				});
				app.alertSuccess('[[admin/manage/users:alerts.create-success]]');
			}, err => errorEl.translateHtml('[[admin/manage/users:alerts.error-x, ' + err.status.message + ']]').removeClass('hidden'));
		}

		handleSearch();

		handleUserCreate();

		handleInvite();

		handleSort();
		handleFilter();
	};

	function handleSearch() {
		var timeoutId = 0;
		function doSearch() {
			$('.fa-spinner').removeClass('hidden');
			loadSearchPage({
				searchBy: $('#user-search-by').val(),
				query: $('#user-search').val(),
				page: 1,
			});
		}
		$('#user-search').on('keyup', function () {
			if (timeoutId !== 0) {
				clearTimeout(timeoutId);
				timeoutId = 0;
			}
			timeoutId = setTimeout(doSearch, 250);
		});
		$('#user-search-by').on('change', function () {
			doSearch();
		});
	}

	function loadSearchPage(query) {
		var params = utils.params();
		params.searchBy = query.searchBy;
		params.query = query.query;
		params.page = query.page;
		var qs = decodeURIComponent($.param(params));
		$.get(config.relative_path + '/api/admin/manage/users?' + qs, renderSearchResults).fail(function (xhrErr) {
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
			if (!$('#user-search').val()) {
				$('#user-found-notify').addClass('hidden');
				$('#user-notfound-notify').addClass('hidden');
				return;
			}
			if (data && data.users.length === 0) {
				$('#user-notfound-notify').translateHtml('[[admin/manage/users:search.not-found]]')
					.removeClass('hidden');
				$('#user-found-notify').addClass('hidden');
			} else {
				$('#user-found-notify').translateHtml(
					translator.compile('admin/manage/users:alerts.x-users-found', data.matchCount, data.timing)
				).removeClass('hidden');
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

	function buildSearchQuery(params) {
		if ($('#user-search').val()) {
			params.query = $('#user-search').val();
			params.searchBy = $('#user-search-by').val();
		} else {
			params.query = undefined;
			params.searchBy = undefined;
		}

		return decodeURIComponent($.param(params));
	}

	function handleSort() {
		$('.users-table thead th').on('click', function () {
			var $this = $(this);
			var sortBy = $this.attr('data-sort');
			if (!sortBy) {
				return;
			}
			var params = utils.params();
			params.sortBy = sortBy;
			if (ajaxify.data.sortBy === sortBy) {
				params.sortDirection = ajaxify.data.reverse ? 'asc' : 'desc';
			} else {
				params.sortDirection = 'desc';
			}

			var qs = buildSearchQuery(params);
			ajaxify.go('admin/manage/users?' + qs);
		});
	}

	function handleFilter() {
		function getFilters() {
			var filters = [];
			$('#filter-by').find('[data-filter-by]').each(function () {
				if ($(this).find('.fa-check').length) {
					filters.push($(this).attr('data-filter-by'));
				}
			});
			return filters;
		}

		var currentFilters = getFilters();
		$('#filter-by').on('click', 'li', function () {
			var $this = $(this);
			$this.find('i').toggleClass('fa-check', !$this.find('i').hasClass('fa-check'));
			return false;
		});

		$('#filter-by').on('hidden.bs.dropdown', function () {
			var filters = getFilters();
			var changed = filters.length !== currentFilters.length;
			if (filters.length === currentFilters.length) {
				filters.forEach(function (filter, i) {
					if (filter !== currentFilters[i]) {
						changed = true;
					}
				});
			}
			currentFilters = getFilters();
			if (changed) {
				var params = utils.params();
				params.filter = filters;
				var qs = buildSearchQuery(params);
				ajaxify.go('admin/manage/users?' + qs);
			}
		});
	}

	return Users;
});
