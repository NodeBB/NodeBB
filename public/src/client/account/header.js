'use strict';
/* globals define, app, config, ajaxify, socket, bootbox, templates */

define('forum/account/header', [
	'coverPhoto',
	'uploader',
	'components',
	'translator'
], function (coverPhoto, uploader, components, translator) {
	var AccountHeader = {};
	var isAdminOrSelfOrGlobalMod;

	AccountHeader.init = function () {
		isAdminOrSelfOrGlobalMod = ajaxify.data.isAdmin || ajaxify.data.isSelf || ajaxify.data.isGlobalModerator;

		hidePrivateLinks();
		selectActivePill();

		if (isAdminOrSelfOrGlobalMod) {
			setupCoverPhoto();
		}

		components.get('account/follow').on('click', function () {
			toggleFollow('follow');
		});

		components.get('account/unfollow').on('click', function () {
			toggleFollow('unfollow');
		});

		components.get('account/chat').on('click', function () {
			socket.emit('modules.chats.hasPrivateChat', ajaxify.data.uid, function (err, roomId) {
				if (err) {
					return app.alertError(err.message);
				}
				if (roomId) {
					app.openChat(roomId);
				} else {
					app.newChat(ajaxify.data.uid);
				}
			});
		});

		components.get('account/ban').on('click', banAccount);
		components.get('account/unban').on('click', unbanAccount);
		components.get('account/delete').on('click', deleteAccount);
	};

	function hidePrivateLinks() {
		if (!app.user.uid || app.user.uid !== parseInt(ajaxify.data.theirid, 10)) {
			$('.account-sub-links .plugin-link.private').addClass('hide');
		}
	}

	function selectActivePill() {
		$('.account-sub-links li').removeClass('active').each(function () {
			var href = $(this).find('a').attr('href');

			if (decodeURIComponent(href) === decodeURIComponent(window.location.pathname)) {
				$(this).addClass('active');
				return false;
			}
		});
	}

	function setupCoverPhoto() {
		coverPhoto.init(components.get('account/cover'),
			function (imageData, position, callback) {
				socket.emit('user.updateCover', {
					uid: ajaxify.data.uid,
					imageData: imageData,
					position: position
				}, callback);
			},
			function () {
				uploader.show({
					title: '[[user:upload_cover_picture]]',
					route: config.relative_path + '/api/user/' + ajaxify.data.userslug + '/uploadcover',
					params: {uid: ajaxify.data.uid },
					accept: '.png,.jpg,.bmp'
				}, function (imageUrlOnServer) {
					components.get('account/cover').css('background-image', 'url(' + imageUrlOnServer + '?v=' + Date.now() + ')');
				});
			},
			removeCover
		);
	}

	function toggleFollow(type) {
		socket.emit('user.' + type, {
			uid: ajaxify.data.uid
		}, function (err) {
			if (err) {
				return app.alertError(err.message);
			}

			components.get('account/follow').toggleClass('hide', type === 'follow');
			components.get('account/unfollow').toggleClass('hide', type === 'unfollow');
			app.alertSuccess('[[global:alert.' + type + ', ' + ajaxify.data.username + ']]');
		});
		return false;
	}

	function banAccount() {
		templates.parse('admin/partials/temporary-ban', {}, function (html) {
			bootbox.dialog({
				className: 'ban-modal',
				title: '[[user:ban_account]]',
				message: html,
				show: true,
				buttons: {
					close: {
						label: '[[global:close]]',
						className: 'btn-link'
					},
					submit: {
						label: '[[user:ban_account]]',
						callback: function () {
							var formData = $('.ban-modal form').serializeArray().reduce(function (data, cur) {
								data[cur.name] = cur.value;
								return data;
							}, {});
							var until = formData.length ? (Date.now() + formData.length * 1000 * 60 * 60 * (parseInt(formData.unit, 10) ? 24 : 1)) : 0;

							socket.emit('user.banUsers', { uids: [ajaxify.data.theirid], until: until, reason: formData.reason || '' }, function (err) {
								if (err) {
									return app.alertError(err.message);
								}
								ajaxify.refresh();
							});
						}
					}
				}
			});
		});
	}

	function unbanAccount() {
		socket.emit('user.unbanUsers', [ajaxify.data.theirid], function (err) {
			if (err) {
				return app.alertError(err.message);
			}
			ajaxify.refresh();
		});
	}

	function deleteAccount() {
		translator.translate('[[user:delete_this_account_confirm]]', function (translated) {
			bootbox.confirm(translated, function (confirm) {
				if (!confirm) {
					return;
				}

				socket.emit('admin.user.deleteUsersAndContent', [ajaxify.data.theirid], function (err) {
					if (err) {
						return app.alertError(err.message);
					}
					app.alertSuccess('[[user:account-deleted]]');
					history.back();
				});
			});
		});
	}

	function removeCover() {
		socket.emit('user.removeCover', {
			uid: ajaxify.data.uid
		}, function (err) {
			if (!err) {
				ajaxify.refresh();
			} else {
				app.alertError(err.message);
			}
		});
	}

	return AccountHeader;
});
