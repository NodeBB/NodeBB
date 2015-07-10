"use strict";
/*global define, templates, socket, ajaxify, app, admin, bootbox, utils, config */

define('admin/manage/groups', [
	'translator',
	'components'
], function(translator, components) {
	var	Groups = {};

	var intervalId = 0;

	Groups.init = function() {
		var	createModal = $('#create-modal'),
			createGroupName = $('#create-group-name'),
			createModalGo = $('#create-modal-go'),
			createModalError = $('#create-modal-error');

		handleSearch();

		createModal.on('keypress', function(e) {
			if (e.keyCode === 13) {
				createModalGo.click();
			}
		});

		$('#create').on('click', function() {
			createModal.modal('show');
			setTimeout(function() {
				createGroupName.focus();
			}, 250);
		});

		createModalGo.on('click', function() {
			var submitObj = {
					name: createGroupName.val(),
					description: $('#create-group-desc').val()
				},
				errorText;

			socket.emit('admin.groups.create', submitObj, function(err) {
				if (err) {
					if (err.hasOwnProperty('message') && utils.hasLanguageKey(err.message)) {
						translator.translate(err.message, config.defaultLang, function(translated) {
							createModalError.html(translated).removeClass('hide');
						});
					} else {
						createModalError.html('<strong>Uh-Oh</strong><p>There was a problem creating your group. Please try again later!</p>').removeClass('hide');
					}
				} else {
					createModalError.addClass('hide');
					createGroupName.val('');
					createModal.on('hidden.bs.modal', function() {
						ajaxify.refresh();
					});
					createModal.modal('hide');
				}
			});
		});

		$('.groups-list').on('click', 'button[data-action]', function() {
			var el = $(this),
				action = el.attr('data-action'),
				groupName = el.parents('tr[data-groupname]').attr('data-groupname');

			switch (action) {
			case 'delete':
				bootbox.confirm('Are you sure you wish to delete this group?', function(confirm) {
					if (confirm) {
						socket.emit('groups.delete', {
							groupName: groupName
						}, function(err, data) {
							if(err) {
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
		function doSearch() {
			if (!queryEl.val()) {
				return ajaxify.refresh();
			}
			$('.pagination').addClass('hide');
			var groupsEl = $('.groups-list');
			socket.emit('groups.search', {
				query: queryEl.val(),
				options: {
					sort: 'date'
				}
			}, function(err, groups) {
				templates.parse('admin/manage/groups', 'groups', {
					groups: groups
				}, function(html) {
					groupsEl.find('[data-groupname]').remove();
					groupsEl.find('tr').after(html);
				});
			});
		}

		var queryEl = $('#group-search');

		queryEl.on('keyup', function() {
			if (intervalId) {
				clearTimeout(intervalId);
				intervalId = 0;
			}
			intervalId = setTimeout(doSearch, 200);
		});
	}


	return Groups;
});
