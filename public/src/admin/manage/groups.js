'use strict';

define('admin/manage/groups', [
	'categorySelector',
	'slugify',
	'api',
], function (categorySelector, slugify, api) {
	var	Groups = {};

	var intervalId = 0;

	Groups.init = function () {
		var	createModal = $('#create-modal');
		var createGroupName = $('#create-group-name');
		var createModalGo = $('#create-modal-go');
		var createModalError = $('#create-modal-error');

		handleSearch();

		createModal.on('keypress', function (e) {
			if (e.keyCode === 13) {
				createModalGo.click();
			}
		});

		$('#create').on('click', function () {
			createModal.modal('show');
			setTimeout(function () {
				createGroupName.focus();
			}, 250);
		});

		createModalGo.on('click', function () {
			var submitObj = {
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

		$('.groups-list').on('click', '[data-action]', function () {
			var el = $(this);
			var action = el.attr('data-action');
			var groupName = el.parents('tr[data-groupname]').attr('data-groupname');

			switch (action) {
				case 'delete':
					bootbox.confirm('[[admin/manage/groups:alerts.confirm-delete]]', function (confirm) {
						if (confirm) {
							api.del(`/groups/${slugify(groupName)}`, {}).then(ajaxify.refresh).catch(app.alertError);
						}
					});
					break;
			}
		});

		enableCategorySelectors();
	};

	function enableCategorySelectors() {
		$('.groups-list [component="category-selector"]').each(function () {
			var nameEncoded = $(this).parents('[data-name-encoded]').attr('data-name-encoded');
			categorySelector.init($(this), {
				onSelect: function (selectedCategory) {
					ajaxify.go('admin/manage/privileges/' + selectedCategory.cid + '?group=' + nameEncoded);
				},
				showLinks: true,
			});
		});
	}

	function handleSearch() {
		var queryEl = $('#group-search');

		function doSearch() {
			if (!queryEl.val()) {
				return ajaxify.refresh();
			}
			$('.pagination').addClass('hide');
			var groupsEl = $('.groups-list');
			socket.emit('groups.search', {
				query: queryEl.val(),
				options: {
					sort: 'date',
				},
			}, function (err, groups) {
				if (err) {
					return app.alertError(err.message);
				}

				app.parseAndTranslate('admin/manage/groups', 'groups', {
					groups: groups,
					categories: ajaxify.data.categories,
				}, function (html) {
					groupsEl.find('[data-groupname]').remove();
					groupsEl.find('tbody').append(html);
					enableCategorySelectors();
				});
			});
		}

		queryEl.on('keyup', function () {
			if (intervalId) {
				clearTimeout(intervalId);
				intervalId = 0;
			}
			intervalId = setTimeout(doSearch, 200);
		});
	}


	return Groups;
});
