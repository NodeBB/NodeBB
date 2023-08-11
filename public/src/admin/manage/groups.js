'use strict';

define('admin/manage/groups', [
	'categorySelector',
	'slugify',
	'api',
	'bootbox',
	'alerts',
], function (categorySelector, slugify, api, bootbox, alerts) {
	const Groups = {};

	Groups.init = function () {
		handleCreate();

		handleSearch();


		$('.groups-list').on('click', '[data-action]', function () {
			const el = $(this);
			const action = el.attr('data-action');
			const groupName = el.parents('tr[data-groupname]').attr('data-groupname');

			switch (action) {
				case 'delete':
					bootbox.confirm('[[admin/manage/groups:alerts.confirm-delete]]', function (confirm) {
						if (confirm) {
							api.del(`/groups/${slugify(groupName)}`, {}).then(ajaxify.refresh).catch(alerts.error);
						}
					});
					break;
			}
		});
	};

	function handleCreate() {
		$('#create').on('click', function () {
			app.parseAndTranslate('admin/partials/create_group_modal', {}).then((html) => {
				html.modal('show');

				html.on('shown.bs.modal', function () {
					const createModal = $('#create-modal');
					const createGroupName = $('#create-group-name');
					const createModalGo = $('#create-modal-go');
					const createModalError = $('#create-modal-error');

					createGroupName.trigger('focus');
					createModal.on('keypress', function (e) {
						if (e.key === 'Enter') {
							createModalGo.trigger('click');
						}
					});
					html.on('hidden.bs.modal', function () {
						html.modal('hide');
						createModal.remove();
					});
					createModalGo.on('click', function () {
						const submitObj = {
							name: createGroupName.val(),
							description: $('#create-group-desc').val(),
							private: $('#create-group-private').is(':checked') ? 1 : 0,
							hidden: $('#create-group-hidden').is(':checked') ? 1 : 0,
						};

						api.post('/groups', submitObj).then((response) => {
							createModalError.addClass('hide');
							createGroupName.val('');
							createModal.on('hidden.bs.modal', function () {
								ajaxify.go('admin/manage/groups/' + response.name);
							});
							createModal.modal('hide');
						}).catch((err) => {
							if (!utils.hasLanguageKey(err.status.message)) {
								err.status.message = '[[admin/manage/groups:alerts.create-failure]]';
							}
							createModalError.translateHtml(err.status.message).removeClass('hide');
						});
					});
				});
			});
		});
	}

	function handleSearch() {
		const queryEl = $('#group-search');

		function doSearch() {
			if (!queryEl.val()) {
				return ajaxify.refresh();
			}
			$('.pagination').addClass('hide');
			const groupsEl = $('.groups-list');
			socket.emit('groups.search', {
				query: queryEl.val(),
				options: {
					sort: 'date',
				},
			}, function (err, groups) {
				if (err) {
					return alerts.error(err);
				}

				app.parseAndTranslate('admin/manage/groups', 'groups', {
					groups: groups,
					categories: ajaxify.data.categories,
				}, function (html) {
					groupsEl.find('[data-groupname]').remove();
					groupsEl.find('tbody').append(html);
				});
			});
		}

		queryEl.on('keyup', utils.debounce(doSearch, 200));
	}


	return Groups;
});
