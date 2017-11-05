'use strict';


define('admin/manage/group', [
	'forum/groups/memberlist',
	'iconSelect',
	'admin/modules/colorpicker',
	'translator',
	'benchpress',
], function (memberList, iconSelect, colorpicker, translator, Benchpress) {
	var Groups = {};

	Groups.init = function () {
		var	groupDetailsSearch = $('#group-details-search');
		var groupDetailsSearchResults = $('#group-details-search-results');
		var groupIcon = $('#group-icon');
		var changeGroupUserTitle = $('#change-group-user-title');
		var changeGroupLabelColor = $('#change-group-label-color');
		var groupLabelPreview = $('#group-label-preview');
		var searchDelay;


		var groupName = ajaxify.data.group.name;

		$('#group-selector').on('change', function () {
			ajaxify.go('admin/manage/groups/' + $(this).val() + window.location.hash);
		});

		memberList.init('admin/manage/group');

		changeGroupUserTitle.keyup(function () {
			groupLabelPreview.text(changeGroupUserTitle.val());
		});

		changeGroupLabelColor.keyup(function () {
			groupLabelPreview.css('background', changeGroupLabelColor.val() || '#000000');
		});

		groupDetailsSearch.on('keyup', function () {
			if (searchDelay) {
				clearTimeout(searchDelay);
			}

			searchDelay = setTimeout(function () {
				var searchText = groupDetailsSearch.val();
				var foundUser;

				socket.emit('admin.user.search', {
					query: searchText,
				}, function (err, results) {
					if (!err && results && results.users.length > 0) {
						var numResults = results.users.length;
						var x;
						if (numResults > 20) {
							numResults = 20;
						}

						groupDetailsSearchResults.empty();

						for (x = 0; x < numResults; x += 1) {
							foundUser = $('<li />');
							foundUser
								.attr({
									title: results.users[x].username,
									'data-uid': results.users[x].uid,
									'data-username': results.users[x].username,
									'data-userslug': results.users[x].userslug,
									'data-picture': results.users[x].picture,
									'data-usericon-bgColor': results.users[x]['icon:bgColor'],
									'data-usericon-text': results.users[x]['icon:text'],
								})
								.append(results.users[x].picture ?
									$('<img />').addClass('avatar avatar-sm').attr('src', results.users[x].picture) :
									$('<div />').addClass('avatar avatar-sm').css('background-color', results.users[x]['icon:bgColor']).html(results.users[x]['icon:text']))
								.append($('<span />').html(results.users[x].username));

							groupDetailsSearchResults.append(foundUser);
						}
					} else {
						groupDetailsSearchResults.translateHtml('<li>[[admin/manage/groups:edit.no-users-found]]</li>');
					}
				});
			}, 200);
		});

		groupDetailsSearchResults.on('click', 'li[data-uid]', function () {
			var userLabel = $(this);
			var uid = parseInt(userLabel.attr('data-uid'), 10);

			socket.emit('admin.groups.join', {
				groupName: groupName,
				uid: uid,
			}, function (err) {
				if (err) {
					return app.alertError(err.message);
				}

				var member = {
					uid: userLabel.attr('data-uid'),
					username: userLabel.attr('data-username'),
					userslug: userLabel.attr('data-userslug'),
					picture: userLabel.attr('data-picture'),
					'icon:bgColor': userLabel.attr('data-usericon-bgColor'),
					'icon:text': userLabel.attr('data-usericon-text'),
				};

				Benchpress.parse('admin/partials/groups/memberlist', 'group.members', {
					group: {
						isOwner: ajaxify.data.group.isOwner,
						members: [member],
					},
				}, function (html) {
					translator.translate(html, function (html) {
						$('[component="groups/members"] tbody').prepend(html);
					});
				});
			});
		});

		$('[component="groups/members"]').on('click', '[data-action]', function () {
			var btnEl = $(this);
			var userRow = btnEl.parents('[data-uid]');
			var ownerFlagEl = userRow.find('.member-name .user-owner-icon');
			var isOwner = !ownerFlagEl.hasClass('invisible');
			var uid = userRow.attr('data-uid');
			var action = btnEl.attr('data-action');

			switch (action) {
			case 'toggleOwnership':
				socket.emit('groups.' + (isOwner ? 'rescind' : 'grant'), {
					toUid: uid,
					groupName: groupName,
				}, function (err) {
					if (err) {
						return app.alertError(err.message);
					}
					ownerFlagEl.toggleClass('invisible');
				});
				break;

			case 'kick':
				bootbox.confirm('[[admin/manage/groups:edit.confirm-remove-user]]', function (confirm) {
					if (!confirm) {
						return;
					}
					socket.emit('admin.groups.leave', {
						uid: uid,
						groupName: groupName,
					}, function (err) {
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

		$('#group-icon').on('click', function () {
			iconSelect.init(groupIcon);
		});

		colorpicker.enable(changeGroupLabelColor, function (hsb, hex) {
			groupLabelPreview.css('background-color', '#' + hex);
		});

		$('#save').on('click', function () {
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
					disableJoinRequests: $('#group-disableJoinRequests').is(':checked'),
				},
			}, function (err) {
				if (err) {
					return app.alertError(err.message);
				}

				var newName = $('#change-group-name').val();

				// If the group name changed, change url
				if (groupName === newName) {
					app.alertSuccess('[[admin/manage/groups:edit.save-success]]');
				} else {
					ajaxify.go('admin/manage/groups/' + encodeURIComponent(newName), undefined, true);
				}
			});
			return false;
		});
	};

	return Groups;
});
