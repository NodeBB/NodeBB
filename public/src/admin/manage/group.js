"use strict";
/*global define, templates, socket, ajaxify, app, bootbox */

define('admin/manage/group', [
	'forum/groups/memberlist',
	'iconSelect',
	'admin/modules/colorpicker',
	'translator'
], function(memberList, iconSelect, colorpicker, translator) {
	var	Groups = {};

	Groups.init = function() {
		var	groupDetailsSearch = $('#group-details-search'),
			groupDetailsSearchResults = $('#group-details-search-results'),
			groupIcon = $('#group-icon'),
			changeGroupUserTitle = $('#change-group-user-title'),
			changeGroupLabelColor = $('#change-group-label-color'),
			groupLabelPreview = $('#group-label-preview'),
			searchDelay;


		var groupName = ajaxify.data.group.name;

		memberList.init();

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
								.attr({title: results.users[x].username,
									'data-uid': results.users[x].uid,
									'data-username': results.users[x].username,
									'data-userslug': results.users[x].userslug,
									'data-picture': results.users[x].picture,
									'data-usericon-bgColor': results.users[x]['icon:bgColor'],
									'data-usericon-text': results.users[x]['icon:text']
								})
								.append(results.users[x].picture ?
									$('<img />').addClass('avatar avatar-sm').attr('src', results.users[x].picture) :
									$('<div />').addClass('avatar avatar-sm').css('background-color', results.users[x]['icon:bgColor']).html(results.users[x]['icon:text']))
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
				uid = parseInt(userLabel.attr('data-uid'), 10);

			socket.emit('admin.groups.join', {
				groupName: groupName,
				uid: uid
			}, function(err) {
				if (err) {
					return app.alertError(err.message);
				}

				var member = {
					uid: userLabel.attr('data-uid'),
					username: userLabel.attr('data-username'),
					userslug: userLabel.attr('data-userslug'),
					picture: userLabel.attr('data-picture'),
					"icon:bgColor": userLabel.attr('data-usericon-bgColor'),
					"icon:text": userLabel.attr('data-usericon-text')
				};

				templates.parse('partials/groups/memberlist', 'members', {group: {isOwner: ajaxify.data.group.isOwner, members: [member]}}, function(html) {
					translator.translate(html, function(html) {
						$('[component="groups/members"] tbody').prepend(html);
					});
				});
			});
		});

		$('[component="groups/members"]').on('click', '[data-action]', function() {
			var btnEl = $(this),
				userRow = btnEl.parents('[data-uid]'),
				ownerFlagEl = userRow.find('.member-name i'),
				isOwner = !ownerFlagEl.hasClass('invisible') ? true : false,
				uid = userRow.attr('data-uid'),
				action = btnEl.attr('data-action');

			switch(action) {
				case 'toggleOwnership':
					socket.emit('groups.' + (isOwner ? 'rescind' : 'grant'), {
						toUid: uid,
						groupName: groupName
					}, function(err) {
						if (err) {
							return app.alertError(err.message);
						}
						ownerFlagEl.toggleClass('invisible');
					});
					break;

				case 'kick':
					bootbox.confirm('Are you sure you want to remove this user?', function(confirm) {
						if (!confirm) {
							return;
						}
						socket.emit('admin.groups.leave', {
							uid: uid,
							groupName: groupName
						}, function(err) {
							if (err) {
								return app.alertError(err.message);
							}
							userRow.slideUp().remove();
						});

					});
					break;
				default:
					break;
			}
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
					userTitleEnabled: $('#group-userTitleEnabled').is(':checked'),
					private: $('#group-private').is(':checked'),
					hidden: $('#group-hidden').is(':checked'),
					disableJoinRequests: $('#group-disableJoinRequests').is(':checked')
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
