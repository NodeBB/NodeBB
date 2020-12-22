'use strict';

define('admin/manage/group', [
	'forum/groups/memberlist',
	'iconSelect',
	'translator',
	'categorySelector',
	'groupSearch',
	'slugify',
	'api',
], function (memberList, iconSelect, translator, categorySelector, groupSearch, slugify, api) {
	var Groups = {};

	Groups.init = function () {
		var groupIcon = $('#group-icon');
		var changeGroupUserTitle = $('#change-group-user-title');
		var changeGroupLabelColor = $('#change-group-label-color');
		var changeGroupTextColor = $('#change-group-text-color');
		var groupLabelPreview = $('#group-label-preview');
		var groupLabelPreviewText = $('#group-label-preview-text');

		var groupName = ajaxify.data.group.name;

		$('#group-selector').on('change', function () {
			ajaxify.go('admin/manage/groups/' + $(this).val() + window.location.hash);
		});

		memberList.init('admin/manage/group');

		changeGroupUserTitle.on('keyup', function () {
			groupLabelPreviewText.translateText(changeGroupUserTitle.val());
		});

		changeGroupLabelColor.on('keyup input', function () {
			groupLabelPreview.css('background-color', changeGroupLabelColor.val() || '#000000');
		});

		changeGroupTextColor.on('keyup input', function () {
			groupLabelPreview.css('color', changeGroupTextColor.val() || '#ffffff');
		});

		setupGroupMembersMenu(groupName);

		$('#group-icon, #group-icon-label').on('click', function () {
			var currentIcon = groupIcon.attr('value');
			iconSelect.init(groupIcon, function () {
				var newIcon = groupIcon.attr('value');
				if (newIcon === currentIcon) {
					return;
				}
				if (newIcon === 'fa-nbb-none') {
					newIcon = 'hidden';
				}
				$('#group-icon-preview').attr('class', 'fa fa-fw ' + (newIcon || 'hidden'));
				app.flags = app.flags || {};
				app.flags._unsaved = true;
			});
		});

		categorySelector.init($('[component="category-selector"]'), function (selectedCategory) {
			navigateToCategory(selectedCategory.cid);
		});

		groupSearch.init($('[component="group-selector"]'));

		$('form [data-property]').on('change', function () {
			app.flags = app.flags || {};
			app.flags._unsaved = true;
		});

		$('#save').on('click', function () {
			api.put(`/groups/${slugify(groupName)}`, {
				name: $('#change-group-name').val(),
				userTitle: changeGroupUserTitle.val(),
				description: $('#change-group-desc').val(),
				icon: groupIcon.attr('value'),
				labelColor: changeGroupLabelColor.val(),
				textColor: changeGroupTextColor.val(),
				userTitleEnabled: $('#group-userTitleEnabled').is(':checked'),
				private: $('#group-private').is(':checked'),
				hidden: $('#group-hidden').is(':checked'),
				memberPostCids: $('#memberPostCids').val(),
				disableJoinRequests: $('#group-disableJoinRequests').is(':checked'),
				disableLeave: $('#group-disableLeave').is(':checked'),
			}).then(() => {
				var newName = $('#change-group-name').val();

				// If the group name changed, change url
				if (groupName !== newName) {
					ajaxify.go('admin/manage/groups/' + encodeURIComponent(newName), undefined, true);
				}

				app.alertSuccess('[[admin/manage/groups:edit.save-success]]');
			}).catch(app.alertError);
			return false;
		});
	};

	function setupGroupMembersMenu(groupName) {
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
						api.del('/groups/' + ajaxify.data.group.slug + '/membership/' + uid).then(() => {
							userRow.slideUp().remove();
						}).catch(app.alertError);
					});
					break;
				default:
					break;
			}
		});
	}

	function navigateToCategory(cid) {
		if (cid) {
			var url = 'admin/manage/privileges/' + cid + '?group=' + ajaxify.data.group.nameEncoded;
			if (app.flags && app.flags._unsaved === true) {
				translator.translate('[[global:unsaved-changes]]', function (text) {
					bootbox.confirm(text, function (navigate) {
						if (navigate) {
							app.flags._unsaved = false;
							ajaxify.go(url);
						}
					});
				});
				return;
			}
			ajaxify.go(url);
		}
	}

	return Groups;
});
