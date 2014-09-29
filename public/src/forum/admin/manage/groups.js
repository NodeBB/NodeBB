"use strict";
/*global define, templates, socket, ajaxify, app, bootbox*/

define('forum/admin/manage/groups', ['forum/admin/iconSelect'], function(iconSelect) {
	var	Groups = {};

	Groups.init = function() {
		var yourid = ajaxify.variables.get('yourid'),
			createModal = $('#create-modal'),
			createGroupName = $('#create-group-name'),
			create = $('#create'),
			createModalGo = $('#create-modal-go'),
			createGroupDesc = $('#create-group-desc'),
			createModalError = $('#create-modal-error'),
			groupDetailsModal = $('#group-details-modal'),
			groupDetailsSearch = $('#group-details-search'),
			groupDetailsSearchResults = $('#group-details-search-results'),
			groupMembersEl = $('ul.current_members'),
			formEl = groupDetailsModal.find('form'),
			detailsModalSave = $('#details-modal-save'),
			groupsList = $('#groups-list'),
			groupIcon = $('#group-icon'),
			changeGroupIcon = $('#change-group-icon'),
			changeGroupName = $('#change-group-name'),
			changeGroupDesc = $('#change-group-desc'),
			changeGroupUserTitle = $('#change-group-user-title'),
			changeGroupLabelColor = $('#change-group-label-color'),
			groupIcon = $('#group-icon'),
			groupLabelPreview = $('#group-label-preview'),
			searchDelay;

		// Tooltips
		$('#groups-list .members li').tooltip();

		createModal.on('keypress', function(e) {
			switch(e.keyCode) {
				case 13:
					createModalGo.click();
					break;
				default:
					break;
			}
		});

		create.on('click', function() {
			createModal.modal('show');
			setTimeout(function() {
				createGroupName.focus();
			}, 250);
		});

		createModalGo.on('click', function() {
			var submitObj = {
					name: createGroupName.val(),
					description: createGroupDesc.val()
				},
				errorText;

			socket.emit('admin.groups.create', submitObj, function(err, data) {
				if (err) {
					switch (err) {
						case 'group-exists':
							errorText = '<strong>Please choose another name</strong><p>There seems to be a group with this name already.</p>';
							break;
						case 'name-too-short':
							errorText = '<strong>Please specify a group name</strong><p>A group name is required for administrative purposes.</p>';
							break;
						default:
							errorText = '<strong>Uh-Oh</strong><p>There was a problem creating your group. Please try again later!</p>';
							break;
					}

					createModalError.html(errorText).removeClass('hide');
				} else {
					createModalError.addClass('hide');
					createGroupName.val('');
					createModal.on('hidden.bs.modal', function() {
						ajaxify.go('admin/groups');
					});
					createModal.modal('hide');
				}
			});
		});

		formEl.keypress(function(e) {
			switch(e.keyCode) {
				case 13:
					detailsModalSave.click();
					break;
				default:
					break;
			}
		});

		changeGroupUserTitle.keydown(function() {
			setTimeout(function() {
				groupLabelPreview.text(changeGroupUserTitle.val());
			}, 0);
		});

		changeGroupLabelColor.keydown(function() {
			setTimeout(function() {
				groupLabelPreview.css('background', changeGroupLabelColor.val() || '#000000');
			}, 0);	
		});

		groupsList.on('click', 'button[data-action]', function() {
			var el = $(this),
				action = el.attr('data-action'),
				groupName = el.parents('li[data-groupname]').attr('data-groupname');

			switch (action) {
			case 'delete':
				bootbox.confirm('Are you sure you wish to delete this group?', function(confirm) {
					if (confirm) {
						socket.emit('admin.groups.delete', groupName, function(err, data) {
							if(err) {
								return app.alertError(err.message);
							}

							ajaxify.go('admin/groups');
						});
					}
				});
				break;
			case 'members':
				socket.emit('admin.groups.get', groupName, function(err, groupObj) {

					changeGroupName.val(groupObj.name).prop('readonly', groupObj.system);
					changeGroupDesc.val(groupObj.description);
					changeGroupUserTitle.val(groupObj.userTitle);
					groupIcon.attr('class', 'fa fa-2x ' + groupObj.icon).attr('value', groupObj.icon);
					changeGroupLabelColor.val(groupObj.labelColor);
					groupLabelPreview.css('background', groupObj.labelColor || '#000000').text(groupObj.userTitle);
					groupMembersEl.empty();

					if (groupObj.members.length > 0) {
						for (var x = 0; x < groupObj.members.length; x++) {
							var memberIcon = $('<li />')
								.attr('data-uid', groupObj.members[x].uid)
								.append($('<img />').attr('src', groupObj.members[x].picture))
								.append($('<span />').html(groupObj.members[x].username));
							groupMembersEl.append(memberIcon);
						}
					}

					groupDetailsModal.attr('data-groupname', groupObj.name);
					groupDetailsModal.modal('show');
				});
				break;
			}
		});

		groupDetailsSearch.on('keyup', function() {

			if (searchDelay) {
				clearTimeout(searchDelay);
			}

			searchDelay = setTimeout(function() {
				var searchText = groupDetailsSearch.val(),
					foundUser;

				socket.emit('admin.user.search', searchText, function(err, results) {
					if (!err && results && results.users.length > 0) {
						var numResults = results.users.length, x;
						if (numResults > 4) {
							numResults = 4;
						}

						groupDetailsSearchResults.empty();
						for (x = 0; x < numResults; x++) {
							foundUser = $('<li />');
							foundUser
								.attr({title: results.users[x].username, 'data-uid': results.users[x].uid})
								.append($('<img />').attr('src', results.users[x].picture))
								.append($('<span />').html(results.users[x].username));

							groupDetailsSearchResults.append(foundUser);
						}
					} else {
						groupDetailsSearchResults.html('<li>No Users Found</li>');
					}
				});
			}, 200);
		});

		groupDetailsSearchResults.on('click', 'li[data-uid]', function() {
			var userLabel = $(this),
				uid = parseInt(userLabel.attr('data-uid'), 10),
				groupName = groupDetailsModal.attr('data-groupname'),
				members = [];

			groupMembersEl.find('li[data-uid]').each(function() {
				members.push(parseInt($(this).attr('data-uid'), 10));
			});

			if (members.indexOf(uid) === -1) {
				socket.emit('admin.groups.join', {
					groupName: groupName,
					uid: uid
				}, function(err, data) {
					if (!err) {
						groupMembersEl.append(userLabel.clone(true));
					}
				});
			}
		});

		groupMembersEl.on('click', 'li[data-uid]', function() {
			var uid = $(this).attr('data-uid'),
				groupName = groupDetailsModal.attr('data-groupname');

			socket.emit('admin.groups.get', groupName, function(err, groupObj){
				if (!err){
					bootbox.confirm('Are you sure you want to remove this user?', function(confirm) {
						if (confirm){
							socket.emit('admin.groups.leave', {
								groupName: groupName,
								uid: uid
							}, function(err, data) {
								if (!err) {
									groupMembersEl.find('li[data-uid="' + uid + '"]').remove();
								}
							});
						}
					});
				}
			});
		});

		changeGroupIcon.on('click', function() {
			iconSelect.init(groupIcon);
		});

		admin.enableColorPicker(changeGroupLabelColor, function(hsb, hex) {
			groupLabelPreview.css('background-color', '#' + hex);
		});

		detailsModalSave.on('click', function() {
			socket.emit('admin.groups.update', {
				groupName: groupDetailsModal.attr('data-groupname'),
				values: {
					name: changeGroupName.val(),
					userTitle: changeGroupUserTitle.val(),
					description: changeGroupDesc.val(),
					icon: groupIcon.attr('value'),
					labelColor: changeGroupLabelColor.val()
				}
			}, function(err) {
				if (!err) {
					groupDetailsModal.on('hidden.bs.modal', function() {
						ajaxify.go('admin/groups');
					});
					groupDetailsModal.modal('hide');
				}
			});
		});

	};

	return Groups;
});
