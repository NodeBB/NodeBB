'use strict';

define('accounts/picture', [
	'pictureCropper',
	'api',
	'bootbox',
	'alerts',
], (pictureCropper, api, bootbox, alerts) => {
	const Picture = {};

	Picture.openChangeModal = () => {
		socket.emit('user.getProfilePictures', {
			uid: ajaxify.data.uid,
		}, function (err, pictures) {
			if (err) {
				return alerts.error(err);
			}

			// boolean to signify whether an uploaded picture is present in the pictures list
			const uploaded = pictures.reduce(function (memo, cur) {
				return memo || cur.type === 'uploaded';
			}, false);

			app.parseAndTranslate('modals/change-picture', {
				pictures: pictures,
				uploaded: uploaded,
				icon: { text: ajaxify.data['icon:text'], bgColor: ajaxify.data['icon:bgColor'] },
				defaultAvatar: ajaxify.data.defaultAvatar,
				allowProfileImageUploads: ajaxify.data.allowProfileImageUploads,
				iconBackgrounds: ajaxify.data.iconBackgrounds,
				user: {
					uid: ajaxify.data.uid,
					username: ajaxify.data.username,
					picture: ajaxify.data.picture,
					'icon:text': ajaxify.data['icon:text'],
					'icon:bgColor': ajaxify.data['icon:bgColor'],
				},
			}, function (html) {
				const modal = bootbox.dialog({
					className: 'picture-switcher',
					title: '[[user:change-picture]]',
					message: html,
					show: true,
					size: 'large',
					buttons: {
						close: {
							label: '[[global:close]]',
							callback: onCloseModal,
							className: 'btn-link',
						},
						update: {
							label: '[[global:save-changes]]',
							callback: saveSelection,
						},
					},
				});

				modal.on('shown.bs.modal', updateImages);
				modal.on('click', '.list-group-item', function selectImageType() {
					modal.find('.list-group-item').removeClass('active');
					$(this).addClass('active');
				});

				modal.on('click', '[data-bg-color]', function () {
					const value = $(this).attr('data-bg-color');
					$(this).addClass('selected').siblings().removeClass('selected');
					modal.find('[component="avatar/icon"]').css('background-color', value);
				});

				handleImageUpload(modal);

				function updateImages() {
					// Check to see which one is the active picture
					if (!ajaxify.data.picture) {
						modal.find('[data-type="default"]').addClass('active');
					} else {
						modal.find('.list-group-item img').each(function () {
							if (this.getAttribute('src') === ajaxify.data.picture) {
								$(this).parents('.list-group-item').addClass('active');
							}
						});
					}

					// Update avatar background colour
					const iconbgEl = modal.find(`[data-bg-color="${ajaxify.data['icon:bgColor']}"]`);
					if (iconbgEl.length) {
						iconbgEl.addClass('selected');
					} else {
						modal.find('[data-bg-color="transparent"]').addClass('selected');
					}
				}

				function saveSelection() {
					const type = modal.find('.list-group-item.active').attr('data-type');
					const iconBgColor = modal.find('[data-bg-color].selected').attr('data-bg-color') || 'transparent';

					changeUserPicture(type, iconBgColor).then(() => {
						Picture.updateHeader(
							type === 'default' ? '' : modal.find('.list-group-item.active img').attr('src'),
							iconBgColor
						);
						ajaxify.refresh();
					}).catch(alerts.error);
				}

				function onCloseModal() {
					modal.modal('hide');
				}
			});
		});
	};

	Picture.updateHeader = (picture, iconBgColor) => {
		if (parseInt(ajaxify.data.theirid, 10) !== parseInt(ajaxify.data.yourid, 10)) {
			return;
		}
		if (!picture && ajaxify.data.defaultAvatar) {
			picture = ajaxify.data.defaultAvatar;
		}
		const headerPictureEl = $(`[component="header/avatar"] [component="avatar/picture"]`);
		const headerIconEl = $(`[component="header/avatar"] [component="avatar/icon"]`);

		if (picture) {
			if (!headerPictureEl.length && headerIconEl.length) {
				const img = $('<img/>');
				$(headerIconEl[0].attributes).each(function () {
					img.attr(this.nodeName, this.nodeValue);
				});
				img.attr('component', 'avatar/picture')
					.attr('src', picture)
					.insertBefore(headerIconEl);
			}
		} else {
			headerPictureEl.remove();
		}

		if (iconBgColor) {
			headerIconEl.css({
				'background-color': iconBgColor,
			});
		}
	};

	function handleImageUpload(modal) {
		function onUploadComplete(urlOnServer) {
			urlOnServer = (!urlOnServer.startsWith('http') ? config.relative_path : '') + urlOnServer;
			const cacheBustedUrl = urlOnServer + '?' + Date.now();
			Picture.updateHeader(cacheBustedUrl);

			if (ajaxify.data.picture && ajaxify.data.picture.length) {
				$(`#user-current-picture, img[data-uid="${ajaxify.data.theirid}"].avatar`).attr('src', cacheBustedUrl);
				ajaxify.data.uploadedpicture = urlOnServer;
				ajaxify.data.picture = urlOnServer;
			} else {
				ajaxify.refresh(function () {
					$(`#user-current-picture, img[data-uid="${ajaxify.data.theirid}"].avatar`).attr('src', cacheBustedUrl);
				});
			}
		}

		function onRemoveComplete() {
			if (ajaxify.data.uploadedpicture === ajaxify.data.picture) {
				ajaxify.refresh();
				Picture.updateHeader();
			}
		}

		modal.find('[data-action="upload"]').on('click', function () {
			modal.modal('hide');

			pictureCropper.show({
				socketMethod: 'user.uploadCroppedPicture',
				route: config.relative_path + '/api/user/' + ajaxify.data.userslug + '/uploadpicture',
				aspectRatio: 1 / 1,
				paramName: 'uid',
				paramValue: ajaxify.data.theirid,
				fileSize: ajaxify.data.maximumProfileImageSize,
				allowSkippingCrop: false,
				title: '[[user:upload-picture]]',
				description: '[[user:upload-a-picture]]',
				accept: ajaxify.data.allowedProfileImageExtensions,
			}, function (url) {
				onUploadComplete(url);
			});

			return false;
		});

		modal.find('[data-action="upload-url"]').on('click', function () {
			modal.modal('hide');
			app.parseAndTranslate('modals/upload-picture-from-url', {}, function (uploadModal) {
				uploadModal.modal('show');

				uploadModal.find('.upload-btn').on('click', function () {
					const url = uploadModal.find('#uploadFromUrl').val();
					if (!url) {
						return false;
					}

					uploadModal.modal('hide');

					pictureCropper.handleImageCrop({
						url: url,
						socketMethod: 'user.uploadCroppedPicture',
						aspectRatio: 1,
						allowSkippingCrop: false,
						paramName: 'uid',
						paramValue: ajaxify.data.theirid,
					}, onUploadComplete);

					return false;
				});
			});

			return false;
		});

		modal.find('[data-action="remove-uploaded"]').on('click', function () {
			socket.emit('user.removeUploadedPicture', {
				uid: ajaxify.data.theirid,
			}, function (err) {
				modal.modal('hide');
				if (err) {
					return alerts.error(err);
				}
				onRemoveComplete();
			});
		});
	}

	function changeUserPicture(type, bgColor) {
		return api.put(`/users/${ajaxify.data.theirid}/picture`, { type, bgColor });
	}

	return Picture;
});
