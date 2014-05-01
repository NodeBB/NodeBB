"use strict";
/*global define, templates, socket, ajaxify, app, bootbox*/

define(function() {
	var	Groups = {};

	Groups.init = function() {
		var yourid = ajaxify.variables.get('yourid'),
			createEl = $('#create'),
			createModal = $('#create-modal'),
			createSubmitBtn = $('#create-modal-go'),
			createNameEl = $('#create-group-name'),
			detailsModal = $('#group-details-modal'),
			detailsSearch = detailsModal.find('#group-details-search'),
			searchResults = detailsModal.find('#group-details-search-results'),
			groupMembersEl = detailsModal.find('ul.current_members'),
			detailsModalSave = detailsModal.find('.btn-primary'),
			searchDelay,
			listEl = $('#groups-list');

		createEl.on('click', function() {
			createModal.modal('show');
			setTimeout(function() {
				createNameEl.focus();
			}, 250);
		});

		createSubmitBtn.on('click', function() {
			var submitObj = {
					name: createNameEl.val(),
					description: $('#create-group-desc').val()
				},
				errorEl = $('#create-modal-error'),
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

					errorEl.html(errorText).removeClass('hide');
				} else {
					errorEl.addClass('hide');
					createNameEl.val('');
					createModal.on('hidden.bs.modal', function() {
						ajaxify.go('admin/groups');
					});
					createModal.modal('hide');
				}
			});
		});

		listEl.on('click', 'button[data-action]', function() {
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
					var formEl = detailsModal.find('form'),
						nameEl = formEl.find('#change-group-name'),
						descEl = formEl.find('#change-group-desc'),
						numMembers = groupObj.members.length,
						x;

					nameEl.val(groupObj.name);
					descEl.val(groupObj.description);

					if (numMembers > 0) {
						groupMembersEl.empty();
						for (x = 0; x < numMembers; x++) {
							var memberIcon = $('<li />')
								.attr('data-uid', groupObj.members[x].uid)
								.append($('<img />').attr('src', groupObj.members[x].picture))
								.append($('<span />').html(groupObj.members[x].username));
							groupMembersEl.append(memberIcon);
						}
					}

					detailsModal.attr('data-groupname', groupObj.name);
					detailsModal.modal('show');
				});
				break;
			}
		});

		detailsSearch.on('keyup', function() {
			var searchEl = this;

			if (searchDelay) {
				clearTimeout(searchDelay);
			}

			searchDelay = setTimeout(function() {
				var searchText = searchEl.value,
					resultsEl = $('#group-details-search-results'),
					foundUser;

				socket.emit('admin.user.search', searchText, function(err, results) {
					if (!err && results && results.users.length > 0) {
						var numResults = results.users.length, x;
						if (numResults > 4) {
							numResults = 4;
						}

						resultsEl.empty();
						for (x = 0; x < numResults; x++) {
							foundUser = $('<li />');
							foundUser
								.attr({title: results.users[x].username, 'data-uid': results.users[x].uid})
								.append($('<img />').attr('src', results.users[x].picture))
								.append($('<span />').html(results.users[x].username));

							resultsEl.append(foundUser);
						}
					} else {
						resultsEl.html('<li>No Users Found</li>');
					}
				});
			}, 200);
		});

		searchResults.on('click', 'li[data-uid]', function() {
			var userLabel = $(this),
				uid = parseInt(userLabel.attr('data-uid'), 10),
				groupName = detailsModal.attr('data-groupname'),
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
				groupName = detailsModal.attr('data-groupname');

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

		detailsModalSave.on('click', function() {
			var formEl = detailsModal.find('form'),
				nameEl = formEl.find('#change-group-name'),
				descEl = formEl.find('#change-group-desc'),
				groupName = detailsModal.attr('data-groupname');

			socket.emit('admin.groups.update', {
				groupName: groupName,
				values: {
					name: nameEl.val(),
					description: descEl.val()
				}
			}, function(err) {
				if (!err) {
					detailsModal.on('hidden.bs.modal', function() {
						ajaxify.go('admin/groups');
					});
					detailsModal.modal('hide');
				}
			});
		});

		// Tooltips
		$('#groups-list .members li').tooltip();
	};

	return Groups;
});
