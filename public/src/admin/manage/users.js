'use strict';

define('admin/manage/users', [
	'translator', 'benchpress', 'autocomplete', 'api', 'slugify', 'bootbox', 'alerts', 'accounts/invite', 'helpers', 'admin/modules/change-email',
], function (translator, Benchpress, autocomplete, api, slugify, bootbox, alerts, AccountInvite, helpers, changeEmail) {
	const Users = {};

	Users.init = function () {
		$('#results-per-page').val(ajaxify.data.resultsPerPage).on('change', function () {
			const query = utils.params();
			query.resultsPerPage = $('#results-per-page').val();
			const qs = buildSearchQuery(query);
			ajaxify.go(window.location.pathname + '?' + qs);
		});

		$('.export-csv').on('click', function () {
			socket.once('event:export-users-csv', function () {
				alerts.remove('export-users-start');
				alerts.alert({
					alert_id: 'export-users',
					type: 'success',
					title: '[[global:alert.success]]',
					message: '[[admin/manage/users:export-users-completed]]',
					clickfn: function () {
						window.location.href = config.relative_path + '/api/admin/users/csv';
					},
					timeout: 0,
				});
			});

			const defaultFields = [
				{ label: '[[admin/manage/users:export-field-email]]', field: 'email', selected: true },
				{ label: '[[admin/manage/users:export-field-username]]', field: 'username', selected: true },
				{ label: '[[admin/manage/users:export-field-uid]]', field: 'uid', selected: true },
				{ label: '[[admin/manage/users:export-field-ip]]', field: 'ip', selected: true },
				{ label: '[[admin/manage/users:export-field-joindate]]', field: 'joindate', selected: false },
				{ label: '[[admin/manage/users:export-field-lastonline]]', field: 'lastonline', selected: false },
				{ label: '[[admin/manage/users:export-field-lastposttime]]', field: 'lastposttime', selected: false },
				{ label: '[[admin/manage/users:export-field-reputation]]', field: 'reputation', selected: false },
				{ label: '[[admin/manage/users:export-field-postcount]]', field: 'postcount', selected: false },
				{ label: '[[admin/manage/users:export-field-topiccount]]', field: 'topiccount', selected: false },
				{ label: '[[admin/manage/users:export-field-profileviews]]', field: 'profileviews', selected: false },
				{ label: '[[admin/manage/users:export-field-followercount]]', field: 'followerCount', selected: false },
				{ label: '[[admin/manage/users:export-field-followingcount]]', field: 'followingCount', selected: false },
				{ label: '[[admin/manage/users:export-field-fullname]]', field: 'fullname', selected: false },
				{ label: '[[admin/manage/users:export-field-birthday]]', field: 'birthday', selected: false },
				{ label: '[[admin/manage/users:export-field-signature]]', field: 'signature', selected: false },
				{ label: '[[admin/manage/users:export-field-aboutme]]', field: 'aboutme', selected: false },
			].concat(ajaxify.data.customUserFields.map(field => ({
				label: field.name,
				field: field.key,
				selected: false,
			})));

			const options = defaultFields.map((field, i) => (`
				<div class="form-check mb-2">
					<input data-field="${field.field}" class="form-check-input" type="checkbox" id="option-${i}" ${field.selected ? 'checked' : ''}>
					<label class="form-check-label" for="option-${i}">
						${field.label}
					</label>
				</div>`
			)).join('');

			const modal = bootbox.dialog({
				message: options,
				title: '[[admin/manage/users:export-users-fields-title]]',
				buttons: {
					submit: {
						label: '[[admin/manage/users:export]]',
						callback: function () {
							const fields = modal.find('[data-field]').filter(
								(index, el) => $(el).is(':checked')
							).map((index, el) => $(el).attr('data-field')).get();
							socket.emit('admin.user.exportUsersCSV', { fields }, function (err) {
								if (err) {
									return alerts.error(err);
								}
								alerts.alert({
									alert_id: 'export-users-start',
									message: '[[admin/manage/users:export-users-started]]',
									timeout: Math.max(5000, (ajaxify.data.userCount / 5000) * 500),
								});
							});
						},
					},
				},
			});

			return false;
		});

		function getSelectedUids() {
			const uids = [];

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

		function removeRow(uid) {
			const checkboxEl = document.querySelector(`.users-table [component="user/select/single"][data-uid="${uid}"]`);
			if (checkboxEl) {
				const rowEl = checkboxEl.closest('.user-row');
				rowEl.parentNode.removeChild(rowEl);
			}
		}

		// use onSuccess instead
		function done(successMessage, className, flag) {
			return function (err) {
				if (err) {
					return alerts.error(err);
				}
				alerts.success(successMessage);
				if (className) {
					update(className, flag);
				}
				unselectAll();
			};
		}

		function onSuccess(successMessage, className, flag) {
			alerts.success(successMessage);
			if (className) {
				update(className, flag);
			}
			unselectAll();
		}

		$('[component="user/select/all"]').on('click', function () {
			$('.users-table [component="user/select/single"]').prop('checked', $(this).is(':checked'));
		});

		$('.manage-groups').on('click', function () {
			const uids = getSelectedUids();
			if (!uids.length) {
				alerts.error('[[error:no-users-selected]]');
				return false;
			}
			socket.emit('admin.user.loadGroups', uids, function (err, data) {
				if (err) {
					return alerts.error(err);
				}
				Benchpress.render('admin/partials/manage_user_groups', data).then(function (html) {
					const modal = bootbox.dialog({
						message: html,
						title: '[[admin/manage/users:manage-groups]]',
						onEscape: true,
					});
					modal.on('shown.bs.modal', function () {
						autocomplete.group(modal.find('.group-search'), function (ev, ui) {
							const uid = $(ev.target).attr('data-uid');
							api.put('/groups/' + ui.item.group.slug + '/membership/' + uid, undefined).then(() => {
								ui.item.group.nameEscaped = translator.escape(ui.item.group.displayName);
								app.parseAndTranslate('admin/partials/manage_user_groups', { users: [{ groups: [ui.item.group] }] }, function (html) {
									$('[data-uid=' + uid + '] .group-area').append(html.find('.group-area').html());
								});
							}).catch(alerts.error);
						});
					});
					modal.on('click', '.group-area a', function () {
						modal.modal('hide');
					});
					modal.on('click', '.remove-group-icon', function () {
						const groupCard = $(this).parents('[data-group-name]');
						const groupName = groupCard.attr('data-group-name');
						const uid = $(this).parents('[data-uid]').attr('data-uid');
						api.del('/groups/' + slugify(groupName) + '/membership/' + uid).then(() => {
							groupCard.remove();
						}).catch(alerts.error);
						return false;
					});
				});
			});
		});

		$('.set-reputation').on('click', function () {
			const uids = getSelectedUids();
			if (!uids.length) {
				alerts.error('[[error:no-users-selected]]');
				return false;
			}
			let currentValue = '';
			if (uids.length === 1) {
				const user = ajaxify.data.users.find(u => u && u.uid === parseInt(uids[0], 10));
				if (user) {
					currentValue = String(user.reputation);
				}
			}
			const modal = bootbox.dialog({
				message: `<input id="new-reputation" type="text" class="form-control" value="${currentValue}">`,
				title: '[[admin/manage/users:set-reputation]]',
				onEscape: true,
				buttons: {
					submit: {
						label: '[[global:save]]',
						callback: function () {
							const newReputation = modal.find('#new-reputation').val();
							if (!utils.isNumber(newReputation)) {
								alerts.error('[[error:invalid-data]]');
								return false;
							}
							socket.emit('admin.user.setReputation', {
								value: newReputation,
								uids: uids,
							}).then(() => {
								uids.forEach((uid) => {
									$(`[component="user/reputation"][data-uid="${uid}"]`).text(helpers.formattedNumber(newReputation));
									const user = ajaxify.data.users.find(u => u && u.uid === parseInt(uid, 10));
									if (user) {
										user.reputation = newReputation;
									}
								});
							}).catch(alerts.error);
						},
					},
				},
			});
			modal.on('shown.bs.modal', () => {
				modal.find('#new-reputation').selectRange(0, modal.find('#new-reputation').val().length);
			});
		});

		$('.ban-user').on('click', function () {
			const uids = getSelectedUids();
			if (!uids.length) {
				alerts.error('[[error:no-users-selected]]');
				return false; // specifically to keep the menu open
			}

			bootbox.confirm((uids.length > 1 ? '[[admin/manage/users:alerts.confirm-ban-multi]]' : '[[admin/manage/users:alerts.confirm-ban]]'), function (confirm) {
				if (confirm) {
					Promise.all(uids.map(function (uid) {
						return api.put('/users/' + uid + '/ban');
					})).then(() => {
						onSuccess('[[admin/manage/users:alerts.ban-success]]', '.ban', true);
					}).catch(alerts.error);
				}
			});
		});

		$('.ban-user-temporary').on('click', function () {
			const uids = getSelectedUids();
			if (!uids.length) {
				alerts.error('[[error:no-users-selected]]');
				return false; // specifically to keep the menu open
			}

			Benchpress.render('modals/temporary-ban', {}).then(function (html) {
				const modal = bootbox.dialog({
					title: '[[user:ban-account]]',
					message: html,
					show: true,
					onEscape: true,
					buttons: {
						close: {
							label: '[[global:close]]',
							className: 'btn-link',
						},
						submit: {
							label: '[[admin/manage/users:alerts.button-ban-x, ' + uids.length + ']]',
							callback: function () {
								const formData = modal.find('form').serializeArray().reduce(function (data, cur) {
									data[cur.name] = cur.value;
									return data;
								}, {});
								const until = formData.length > 0 ? (
									Date.now() + (formData.length * 1000 * 60 * 60 * (parseInt(formData.unit, 10) ? 24 : 1))
								) : 0;

								Promise.all(uids.map(function (uid) {
									return api.put('/users/' + uid + '/ban', {
										until: until,
										reason: formData.reason,
									});
								})).then(() => {
									onSuccess('[[admin/manage/users:alerts.ban-success]]', '.ban', true);
								}).catch(alerts.error);
							},
						},
					},
				});
			});
		});

		$('.unban-user').on('click', function () {
			const uids = getSelectedUids();
			if (!uids.length) {
				alerts.error('[[error:no-users-selected]]');
				return false; // specifically to keep the menu open
			}

			Benchpress.render('modals/unban', {}).then(function (html) {
				const modal = bootbox.dialog({
					title: '[[user:unban-account]]',
					message: html,
					show: true,
					onEscape: true,
					buttons: {
						close: {
							label: '[[global:close]]',
							className: 'btn-link',
						},
						submit: {
							label: '[[user:unban-account]]',
							callback: function () {
								const formData = modal.find('form').serializeArray().reduce(function (data, cur) {
									data[cur.name] = cur.value;
									return data;
								}, {});


								Promise.all(uids.map(function (uid) {
									return api.del('/users/' + uid + '/ban', {
										reason: formData.reason || '',
									});
								})).then(() => {
									onSuccess('[[admin/manage/users:alerts.unban-success]]', '.ban', false);
								}).catch(alerts.error);
							},
						},
					},
				});
			});
		});

		$('.reset-lockout').on('click', function () {
			const uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			socket.emit('admin.user.resetLockouts', uids, done('[[admin/manage/users:alerts.lockout-reset-success]]'));
		});

		$('.change-email').on('click', function () {
			const uids = getSelectedUids();
			if (uids.length !== 1) {
				return alerts.error('[[admin/manage/users:alerts.select-a-single-user-to-change-email]]');
			}
			changeEmail.init({
				uid: uids[0],
				onSuccess: function (newEmail) {
					update('.notvalidated', false);
					update('.pending', false);
					update('.expired', false);
					update('.validated', false);
					update('.validated-by-admin', !!newEmail);
					update('.no-email', !newEmail);
					$('.users-table [component="user/select/single"]:checked').parents('.user-row').find('.validated-by-admin .email').text(newEmail);
					// $('.users-table [component="user/select/single"]:checked').parents('.user-row').find('.no-email').
				},
			});
		});

		$('.validate-email').on('click', function () {
			const uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			bootbox.confirm('[[admin/manage/users:alerts.confirm-validate-email]]', function (confirm) {
				if (!confirm) {
					return;
				}
				socket.emit('admin.user.validateEmail', uids, function (err) {
					if (err) {
						return alerts.error(err);
					}
					alerts.success('[[admin/manage/users:alerts.validate-email-success]]');
					update('.notvalidated', false);
					update('.pending', false);
					update('.expired', false);
					update('.validated', false);
					update('.validated-by-admin', true);
					unselectAll();
				});
			});
		});

		$('.send-validation-email').on('click', function () {
			const uids = getSelectedUids();
			if (!uids.length) {
				return;
			}
			socket.emit('admin.user.sendValidationEmail', uids, function (err) {
				if (err) {
					return alerts.error(err);
				}
				alerts.success('[[notifications:email-confirm-sent]]');
			});
		});

		$('.change-password').on('click', async function () {
			const uids = getSelectedUids();
			if (!uids.length) {
				return;
			}
			async function changePassword(modal) {
				const newPassword = modal.find('#newPassword').val();
				const confirmPassword = modal.find('#confirmPassword').val();
				if (newPassword !== confirmPassword) {
					throw new Error('[[[user:change-password-error-match]]');
				}
				await Promise.all(uids.map(uid => api.put('/users/' + uid + '/password', {
					currentPassword: '',
					newPassword: newPassword,
				})));
			}

			const modal = bootbox.dialog({
				message: `<div class="d-flex flex-column gap-2">
					<label class="form-label">[[user:new-password]]</label>
					<input id="newPassword" class="form-control" type="text">
					<label class="form-label">[[user:confirm-password]]</label>
					<input id="confirmPassword" class="form-control" type="text">
				</div>`,
				title: '[[admin/manage/users:change-password]]',
				onEscape: true,
				buttons: {
					cancel: {
						label: '[[admin/manage/users:alerts.button-cancel]]',
						className: 'btn-link',
					},
					change: {
						label: '[[admin/manage/users:alerts.button-change]]',
						className: 'btn-primary',
						callback: function () {
							changePassword(modal).then(() => {
								modal.modal('hide');
							}).catch(alerts.error);
							return false;
						},
					},
				},
			});
		});

		$('.password-reset-email').on('click', function () {
			const uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			bootbox.confirm('[[admin/manage/users:alerts.password-reset-confirm]]', function (confirm) {
				if (confirm) {
					socket.emit('admin.user.sendPasswordResetEmail', uids, done('[[admin/manage/users:alerts.password-reset-email-sent]]'));
				}
			});
		});

		$('.force-password-reset').on('click', function () {
			const uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			bootbox.confirm('[[admin/manage/users:alerts.confirm-force-password-reset]]', function (confirm) {
				if (confirm) {
					socket.emit('admin.user.forcePasswordReset', uids, done('[[admin/manage/users:alerts.validate-force-password-reset-success]]'));
				}
			});
		});

		$('.delete-user').on('click', () => {
			handleDelete('[[admin/manage/users:alerts.confirm-delete]]', '/account');
		});

		$('.delete-user-content').on('click', () => {
			handleDelete('[[admin/manage/users:alerts.confirm-delete-content]]', '/content');
		});

		$('.delete-user-and-content').on('click', () => {
			handleDelete('[[admin/manage/users:alerts.confirm-purge]]', '');
		});

		const tableEl = document.querySelector('.users-table');
		const actionBtn = document.getElementById('action-dropdown');
		tableEl.addEventListener('change', (e) => {
			const subselector = e.target.closest('[component="user/select/single"]') || e.target.closest('[component="user/select/all"]');
			if (subselector) {
				const uids = getSelectedUids();
				if (uids.length) {
					actionBtn.removeAttribute('disabled');
				} else {
					actionBtn.setAttribute('disabled', 'disabled');
				}
			}
		});

		function handleDelete(confirmMsg, path) {
			const uids = getSelectedUids();
			if (!uids.length) {
				return;
			}

			bootbox.confirm(confirmMsg, function (confirm) {
				if (confirm) {
					Promise.all(
						uids.map(
							uid => api.del(`/users/${encodeURIComponent(uid)}${path}`, {}).then(() => {
								if (path !== '/content') {
									removeRow(uid);
								}
							})
						)
					).then(() => {
						if (path !== '/content') {
							alerts.success('[[admin/manage/users:alerts.delete-success]]');
						} else {
							alerts.success('[[admin/manage/users:alerts.delete-content-success]]');
						}
						unselectAll();
						if (!$('.users-table [component="user/select/single"]').length) {
							ajaxify.refresh();
						}
					}).catch(alerts.error);
				}
			});
		}

		function handleUserCreate() {
			$('[data-action="create"]').on('click', function () {
				Benchpress.render('admin/partials/create_user_modal', {}).then(function (html) {
					const modal = bootbox.dialog({
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
			const modal = this;
			const username = document.getElementById('create-user-name').value;
			const email = document.getElementById('create-user-email').value;
			const password = document.getElementById('create-user-password').value;
			const passwordAgain = document.getElementById('create-user-password-again').value;

			const errorEl = $('#create-modal-error');

			if (password !== passwordAgain) {
				return errorEl.translateHtml('[[admin/manage/users:alerts.error-x, [[admin/manage/users:alerts.error-passwords-different]]]]').removeClass('hide');
			}

			const user = {
				username: username,
				email: email,
				password: password,
			};

			api.post('/users', user)
				.then(() => {
					modal.modal('hide');
					modal.on('hidden.bs.modal', function () {
						ajaxify.refresh();
					});
					alerts.success('[[admin/manage/users:alerts.create-success]]');
				})
				.catch(err => errorEl.translateHtml('[[admin/manage/users:alerts.error-x, ' + err.message + ']]').removeClass('hidden'));
		}

		handleSearch();
		handleUserCreate();
		handleSort();
		handleFilter();
		AccountInvite.handle();
	};

	function handleSearch() {
		function doSearch() {
			$('.fa-spinner').removeClass('hidden');
			loadSearchPage({
				searchBy: $('#user-search-by').val(),
				query: $('#user-search').val(),
				page: 1,
			});
		}
		$('#user-search').on('keyup', utils.debounce(doSearch, 250));
		$('#user-search-by').on('change', doSearch);
	}

	function loadSearchPage(query) {
		const params = utils.params();
		params.searchBy = query.searchBy;
		params.query = query.query;
		params.page = query.page;
		params.sortBy = params.sortBy || 'lastonline';
		const qs = $.param(params);
		$.get(config.relative_path + '/api/admin/manage/users?' + qs, function (data) {
			renderSearchResults(data);
			const url = config.relative_path + '/admin/manage/users?' + qs;
			if (history.pushState) {
				history.pushState({
					url: url,
				}, null, window.location.protocol + '//' + window.location.host + url);
			}
		}).fail(function (xhrErr) {
			if (xhrErr && xhrErr.responseJSON && xhrErr.responseJSON.error) {
				alerts.error(xhrErr.responseJSON.error);
			}
		});
	}

	function renderSearchResults(data) {
		Benchpress.render('partials/paginator', { pagination: data.pagination }).then(function (html) {
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

	function buildSearchQuery(params) {
		if ($('#user-search').val()) {
			params.query = $('#user-search').val();
			params.searchBy = $('#user-search-by').val();
		} else {
			delete params.query;
			delete params.searchBy;
		}

		return $.param(params);
	}

	function handleSort() {
		$('.users-table thead th').on('click', function () {
			const $this = $(this);
			const sortBy = $this.attr('data-sort');
			if (!sortBy) {
				return;
			}
			const params = utils.params();
			params.sortBy = sortBy;
			if (ajaxify.data.sortBy === sortBy) {
				params.sortDirection = ajaxify.data.reverse ? 'asc' : 'desc';
			} else {
				params.sortDirection = 'desc';
			}

			const qs = buildSearchQuery(params);
			ajaxify.go('admin/manage/users?' + qs);
		});
	}

	function getFilters() {
		const filters = [];
		$('#filter-by').find('[data-filter-by]').each(function () {
			if ($(this).find('.fa-check').length) {
				filters.push($(this).attr('data-filter-by'));
			}
		});
		return filters;
	}

	function handleFilter() {
		let currentFilters = getFilters();
		$('#filter-by').on('click', 'li', function () {
			const $this = $(this);
			$this.find('i').toggleClass('fa-check', !$this.find('i').hasClass('fa-check'));
			return false;
		});

		$('#filter-by').on('hidden.bs.dropdown', function () {
			const filters = getFilters();
			let changed = filters.length !== currentFilters.length;
			if (filters.length === currentFilters.length) {
				filters.forEach(function (filter, i) {
					if (filter !== currentFilters[i]) {
						changed = true;
					}
				});
			}
			currentFilters = getFilters();
			if (changed) {
				const params = utils.params();
				params.filters = filters;
				const qs = buildSearchQuery(params);
				ajaxify.go('admin/manage/users?' + qs);
			}
		});
	}

	return Users;
});
