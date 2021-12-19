'use strict';

define('admin/manage/admins-mods', [
	'autocomplete', 'api', 'bootbox', 'alerts', 'categorySelector',
], function (autocomplete, api, bootbox, alerts, categorySelector) {
	const AdminsMods = {};

	AdminsMods.init = function () {
		autocomplete.user($('#admin-search'), function (ev, ui) {
			socket.emit('admin.user.makeAdmins', [ui.item.user.uid], function (err) {
				if (err) {
					return alerts.error(err);
				}
				alerts.success('[[admin/manage/users:alerts.make-admin-success]]');
				$('#admin-search').val('');

				if ($('.administrator-area [data-uid="' + ui.item.user.uid + '"]').length) {
					return;
				}

				app.parseAndTranslate('admin/manage/admins-mods', 'admins.members', { admins: { members: [ui.item.user] } }, function (html) {
					$('.administrator-area').prepend(html);
				});
			});
		});

		$('.administrator-area').on('click', '.remove-user-icon', function () {
			const userCard = $(this).parents('[data-uid]');
			const uid = userCard.attr('data-uid');
			if (parseInt(uid, 10) === parseInt(app.user.uid, 10)) {
				return alerts.error('[[admin/manage/users:alerts.no-remove-yourself-admin]]');
			}
			bootbox.confirm('[[admin/manage/users:alerts.confirm-remove-admin]]', function (confirm) {
				if (confirm) {
					socket.emit('admin.user.removeAdmins', [uid], function (err) {
						if (err) {
							return alerts.error(err.message);
						}
						alerts.success('[[admin/manage/users:alerts.remove-admin-success]]');
						userCard.remove();
					});
				}
			});
		});

		autocomplete.user($('#global-mod-search'), function (ev, ui) {
			api.put('/groups/global-moderators/membership/' + ui.item.user.uid).then(() => {
				alerts.success('[[admin/manage/users:alerts.make-global-mod-success]]');
				$('#global-mod-search').val('');

				if ($('.global-moderator-area [data-uid="' + ui.item.user.uid + '"]').length) {
					return;
				}

				app.parseAndTranslate('admin/manage/admins-mods', 'globalMods.members', { globalMods: { members: [ui.item.user] } }, function (html) {
					$('.global-moderator-area').prepend(html);
					$('#no-global-mods-warning').addClass('hidden');
				});
			}).catch(alerts.error);
		});

		$('.global-moderator-area').on('click', '.remove-user-icon', function () {
			const userCard = $(this).parents('[data-uid]');
			const uid = userCard.attr('data-uid');

			bootbox.confirm('[[admin/manage/users:alerts.confirm-remove-global-mod]]', function (confirm) {
				if (confirm) {
					api.del('/groups/global-moderators/membership/' + uid).then(() => {
						alerts.success('[[admin/manage/users:alerts.remove-global-mod-success]]');
						userCard.remove();
						if (!$('.global-moderator-area').children().length) {
							$('#no-global-mods-warning').removeClass('hidden');
						}
					}).catch(alerts.error);
				}
			});
		});


		categorySelector.init($('[component="category-selector"]'), {
			onSelect: function (selectedCategory) {
				ajaxify.go('admin/manage/admins-mods' + (selectedCategory.cid ? '?cid=' + selectedCategory.cid : ''));
			},
			localCategories: [],
		});

		autocomplete.user($('.moderator-search'), function (ev, ui) {
			const input = $(ev.target);
			const cid = $(ev.target).attr('data-cid');
			api.put(`/categories/${cid}/moderator/${ui.item.user.uid}`, {}, function (err) {
				if (err) {
					return alerts.error(err);
				}
				alerts.success('[[admin/manage/users:alerts.make-moderator-success]]');
				input.val('');

				if ($('.moderator-area[data-cid="' + cid + '"] [data-uid="' + ui.item.user.uid + '"]').length) {
					return;
				}

				app.parseAndTranslate('admin/manage/admins-mods', 'globalMods.members', { globalMods: { members: [ui.item.user] } }, function (html) {
					$('.moderator-area[data-cid="' + cid + '"]').prepend(html);
					$('.no-moderator-warning[data-cid="' + cid + '"]').addClass('hidden');
				});
			});
		});

		$('.moderator-area').on('click', '.remove-user-icon', function () {
			const moderatorArea = $(this).parents('[data-cid]');
			const cid = moderatorArea.attr('data-cid');
			const userCard = $(this).parents('[data-uid]');
			const uid = userCard.attr('data-uid');

			bootbox.confirm('[[admin/manage/users:alerts.confirm-remove-moderator]]', function (confirm) {
				if (confirm) {
					api.delete(`/categories/${cid}/moderator/${uid}`, {}, function (err) {
						if (err) {
							return alerts.error(err);
						}
						alerts.success('[[admin/manage/users:alerts.remove-moderator-success]]');
						userCard.remove();
						if (!moderatorArea.children().length) {
							$('.no-moderator-warning[data-cid="' + cid + '"]').removeClass('hidden');
						}
					});
				}
			});
		});
	};

	return AdminsMods;
});
