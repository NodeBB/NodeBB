'use strict';


define('admin/manage/groups', ['translator', 'benchpress'], function (translator, Benchpress) {
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
			};

			socket.emit('admin.groups.create', submitObj, function (err) {
				if (err) {
					if (err.hasOwnProperty('message') && utils.hasLanguageKey(err.message)) {
						err = '[[admin/manage/groups:alerts.create-failure]]';
					}
					createModalError.translateHtml(err).removeClass('hide');
				} else {
					createModalError.addClass('hide');
					createGroupName.val('');
					createModal.on('hidden.bs.modal', function () {
						ajaxify.refresh();
					});
					createModal.modal('hide');
				}
			});
		});

		$('.groups-list').on('click', 'button[data-action]', function () {
			var el = $(this);
			var action = el.attr('data-action');
			var groupName = el.parents('tr[data-groupname]').attr('data-groupname');

			switch (action) {
			case 'delete':
				bootbox.confirm('[[admin/manage/groups:alerts.confirm-delete]]', function (confirm) {
					if (confirm) {
						socket.emit('groups.delete', {
							groupName: groupName,
						}, function (err) {
							if (err) {
								return app.alertError(err.message);
							}

							ajaxify.refresh();
						});
					}
				});
				break;
			}
		});
	};

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

				Benchpress.parse('admin/manage/groups', 'groups', {
					groups: groups,
				}, function (html) {
					translator.translate(html, function (html) {
						groupsEl.find('[data-groupname]').remove();
						groupsEl.find('tr').after(html);
					});
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
