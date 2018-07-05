'use strict';


define('admin/manage/group', [
	'forum/groups/memberlist',
	'iconSelect',
	'admin/modules/colorpicker',
], function (memberList, iconSelect, colorpicker) {
	var Groups = {};

	Groups.init = function () {
		var groupIcon = $('#group-icon');
		var changeGroupUserTitle = $('#change-group-user-title');
		var changeGroupLabelColor = $('#change-group-label-color');
		var groupLabelPreview = $('#group-label-preview');

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
