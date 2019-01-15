'use strict';

define('admin/manage/admins-mods', ['translator', 'benchpress', 'autocomplete'], function (translator, Benchpress, autocomplete) {
	var AdminsMods = {};

	AdminsMods.init = function () {
		autocomplete.user($('#admin-search'), function (ev, ui) {
			socket.emit('admin.user.makeAdmins', [ui.item.user.uid], function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alertSuccess('[[admin/manage/users:alerts.make-admin-success]]');
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
			var userCard = $(this).parents('[data-uid]');
			var uid = userCard.attr('data-uid');
			if (parseInt(uid, 10) === parseInt(app.user.uid, 10)) {
				return app.alertError('[[admin/manage/users:alerts.no-remove-yourself-admin]]');
			}
			bootbox.confirm('[[admin/manage/users:alerts.confirm-remove-admin]]', function (confirm) {
				if (confirm) {
					socket.emit('admin.user.removeAdmins', [uid], function (err) {
						if (err) {
							return app.alertError(err.message);
						}
						app.alertSuccess('[[admin/manage/users:alerts.remove-admin-success]]');
						userCard.remove();
					});
				}
			});
		});

		autocomplete.user($('#global-mod-search'), function (ev, ui) {
			socket.emit('admin.groups.join', {
				groupName: 'Global Moderators',
				uid: ui.item.user.uid,
			}, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alertSuccess('[[admin/manage/users:alerts.make-global-mod-success]]');
				$('#global-mod-search').val('');

				if ($('.global-moderator-area [data-uid="' + ui.item.user.uid + '"]').length) {
					return;
				}

				app.parseAndTranslate('admin/manage/admins-mods', 'globalMods.members', { globalMods: { members: [ui.item.user] } }, function (html) {
					$('.global-moderator-area').prepend(html);
					$('#no-global-mods-warning').addClass('hidden');
				});
			});
		});

		$('.global-moderator-area').on('click', '.remove-user-icon', function () {
			var userCard = $(this).parents('[data-uid]');
			var uid = userCard.attr('data-uid');

			bootbox.confirm('[[admin/manage/users:alerts.confirm-remove-global-mod]]', function (confirm) {
				if (confirm) {
					socket.emit('admin.groups.leave', { uid: uid, groupName: 'Global Moderators' }, function (err) {
						if (err) {
							return app.alertError(err.message);
						}
						app.alertSuccess('[[admin/manage/users:alerts.remove-global-mod-success]]');
						userCard.remove();
						if (!$('.global-moderator-area').children().length) {
							$('#no-global-mods-warning').removeClass('hidden');
						}
					});
				}
			});
		});


		autocomplete.user($('.moderator-search'), function (ev, ui) {
			var input = $(ev.target);
			var cid = $(ev.target).attr('data-cid');
			socket.emit('admin.categories.setPrivilege', {
				cid: cid,
				privilege: ['moderate'],
				set: true,
				member: ui.item.user.uid,
			}, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alertSuccess('[[admin/manage/users:alerts.make-moderator-success]]');
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
			var moderatorArea = $(this).parents('[data-cid]');
			var cid = moderatorArea.attr('data-cid');
			var userCard = $(this).parents('[data-uid]');
			var uid = userCard.attr('data-uid');

			bootbox.confirm('[[admin/manage/users:alerts.confirm-remove-moderator]]', function (confirm) {
				if (confirm) {
					socket.emit('admin.categories.setPrivilege', {
						cid: cid,
						privilege: ['moderate'],
						set: false,
						member: uid,
					}, function (err) {
						if (err) {
							return app.alertError(err.message);
						}
						app.alertSuccess('[[admin/manage/users:alerts.remove-moderator-success]]');
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
