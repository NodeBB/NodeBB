"use strict";
/*global define, templates, socket, ajaxify, app, admin, bootbox, utils, config */

define('admin/manage/groups', [
	'translator',
	'components'
], function(translator, components) {
	var	Groups = {};

	Groups.init = function() {
		var	createModal = $('#create-modal'),
			createGroupName = $('#create-group-name'),
			createModalGo = $('#create-modal-go'),
			createModalError = $('#create-modal-error');

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

	return Groups;
});
