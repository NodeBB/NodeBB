'use strict';

define('admin/manage/group', [
	'forum/groups/memberlist',
	'iconSelect',
	'translator',
	'categorySelector',
	'groupSearch',
	'slugify',
	'api',
	'bootbox',
	'alerts',
], function (memberList, iconSelect, translator, categorySelector, groupSearch, slugify, api, bootbox, alerts) {
	const Groups = {};

	Groups.init = function () {
		const groupIcon = $('#group-icon');
		const changeGroupUserTitle = $('#change-group-user-title');
		const changeGroupLabelColor = $('#change-group-label-color');
		const changeGroupTextColor = $('#change-group-text-color');
		const groupLabelPreview = $('#group-label-preview');
		const groupLabelPreviewText = $('#group-label-preview-text');

		const groupName = ajaxify.data.group.name;

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

		setupGroupMembersMenu();

		$('#group-icon, #group-icon-label').on('click', function () {
			const currentIcon = groupIcon.attr('value');
			iconSelect.init(groupIcon, function () {
				let newIcon = groupIcon.attr('value');
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

		categorySelector.init($('.edit-privileges-selector [component="category-selector"]'), {
			onSelect: function (selectedCategory) {
				navigateToCategory(selectedCategory.cid);
			},
			showLinks: true,
		});

		const cidSelector = categorySelector.init($('.member-post-cids-selector [component="category-selector"]'), {
			onSelect: function (selectedCategory) {
				let cids = ($('#memberPostCids').val() || '').split(',').map(cid => parseInt(cid, 10));
				cids.push(selectedCategory.cid);
				cids = cids.filter((cid, index, array) => array.indexOf(cid) === index);
				$('#memberPostCids').val(cids.join(','));
				cidSelector.selectCategory(0);
			},
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
				const newName = $('#change-group-name').val();

				// If the group name changed, change url
				if (groupName !== newName) {
					ajaxify.go('admin/manage/groups/' + encodeURIComponent(newName), undefined, true);
				}

				alerts.success('[[admin/manage/groups:edit.save-success]]');
			}).catch(alerts.error);
			return false;
		});
	};

	function setupGroupMembersMenu() {
		$('[component="groups/members"]').on('click', '[data-action]', function () {
			const btnEl = $(this);
			const userRow = btnEl.parents('[data-uid]');
			const ownerFlagEl = userRow.find('.member-name .user-owner-icon');
			const isOwner = !ownerFlagEl.hasClass('invisible');
			const uid = userRow.attr('data-uid');
			const action = btnEl.attr('data-action');

			switch (action) {
				case 'toggleOwnership':
					api[isOwner ? 'del' : 'put'](`/groups/${ajaxify.data.group.slug}/ownership/${uid}`, {}).then(() => {
						ownerFlagEl.toggleClass('invisible');
					}).catch(alerts.error);
					break;

				case 'kick':
					bootbox.confirm('[[admin/manage/groups:edit.confirm-remove-user]]', function (confirm) {
						if (!confirm) {
							return;
						}
						api.del('/groups/' + ajaxify.data.group.slug + '/membership/' + uid).then(() => {
							userRow.slideUp().remove();
						}).catch(alerts.error);
					});
					break;
				default:
					break;
			}
		});
	}

	function navigateToCategory(cid) {
		if (cid) {
			const url = 'admin/manage/privileges/' + cid + '?group=' + ajaxify.data.group.nameEncoded;
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
