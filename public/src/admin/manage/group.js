"use strict";
/*global define, templates, socket, ajaxify, app, admin, bootbox, utils, config */

define('admin/manage/group', [
	'iconSelect',
	'admin/modules/colorpicker'
], function(iconSelect, colorpicker) {
	var	Groups = {};

	Groups.init = function() {
		var	groupDetailsSearch = $('#group-details-search'),
			groupDetailsSearchResults = $('#group-details-search-results'),
			groupMembersEl = $('ul.current_members'),
			groupIcon = $('#group-icon'),
			changeGroupUserTitle = $('#change-group-user-title'),
			changeGroupLabelColor = $('#change-group-label-color'),
			groupLabelPreview = $('#group-label-preview'),
			searchDelay;


		var groupName = ajaxify.data.group.name;

		changeGroupUserTitle.keyup(function() {
			groupLabelPreview.text(changeGroupUserTitle.val());
		});

		changeGroupLabelColor.keyup(function() {
			groupLabelPreview.css('background', changeGroupLabelColor.val() || '#000000');
		});

		groupDetailsSearch.on('keyup', function() {

			if (searchDelay) {
				clearTimeout(searchDelay);
			}

			searchDelay = setTimeout(function() {
				var searchText = groupDetailsSearch.val(),
					foundUser;

				socket.emit('admin.user.search', {query: searchText}, function(err, results) {
					if (!err && results && results.users.length > 0) {
						var numResults = results.users.length, x;
						if (numResults > 20) {
							numResults = 20;
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
			var uid = $(this).attr('data-uid');

			bootbox.confirm('Are you sure you want to remove this user?', function(confirm) {
				if (!confirm) {
					return;
				}

				socket.emit('admin.groups.leave', {
					groupName: groupName,
					uid: uid
				}, function(err, data) {
					if (err) {
						return app.alertError(err.message);
					}
					groupMembersEl.find('li[data-uid="' + uid + '"]').remove();
				});
			});
		});

		$('#group-icon').on('click', function() {
			iconSelect.init(groupIcon);
		});

		colorpicker.enable(changeGroupLabelColor, function(hsb, hex) {
			groupLabelPreview.css('background-color', '#' + hex);
		});

		$('.save').on('click', function() {
			socket.emit('admin.groups.update', {
				groupName: groupName,
				values: {
					name: $('#change-group-name').val(),
					userTitle: changeGroupUserTitle.val(),
					description: $('#change-group-desc').val(),
					icon: groupIcon.attr('value'),
					labelColor: changeGroupLabelColor.val(),
					private: $('#group-private').is(':checked'),
					hidden: $('#group-hidden').is(':checked')
				}
			}, function(err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alertSuccess('Changes saved!');
			});
			return false;
		});

	};

	return Groups;
});
