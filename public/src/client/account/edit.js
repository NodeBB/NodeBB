'use strict';

/* globals define, ajaxify, socket, app, config, templates, bootbox */

define('forum/account/edit', ['forum/account/header', 'uploader', 'translator'], function(header, uploader, translator) {
	var AccountEdit = {},
		uploadedPicture = '';

	AccountEdit.init = function() {
		uploadedPicture = ajaxify.data.uploadedpicture;

		header.init();

		$('#submitBtn').on('click', updateProfile);

		app.loadJQueryUI(function() {
			$('#inputBirthday').datepicker({
				changeMonth: true,
				changeYear: true,
				yearRange: '1900:-5y',
				defaultDate: '-13y'
			});
		});

		handleImageChange();
		handleAccountDelete();
		handleEmailConfirm();
		updateSignature();
		updateAboutMe();
	};

	function updateProfile() {
		var userData = {
			uid: $('#inputUID').val(),
			fullname: $('#inputFullname').val(),
			website: $('#inputWebsite').val(),
			birthday: $('#inputBirthday').val(),
			location: $('#inputLocation').val(),
			groupTitle: $('#groupTitle').val(),
			signature: $('#inputSignature').val(),
			aboutme: $('#inputAboutMe').val()
		};

		socket.emit('user.updateProfile', userData, function(err, data) {
			if (err) {
				return app.alertError(err.message);
			}

			app.alertSuccess('[[user:profile_update_success]]');

			if (data.picture) {
				$('#user-current-picture').attr('src', data.picture);
			}

			updateHeader(data.picture);
		});

		return false;
	}

	function updateHeader(picture) {
		require(['components'], function(components) {
			if (parseInt(ajaxify.data.theirid, 10) !== parseInt(ajaxify.data.yourid, 10)) {
				return;
			}

			components.get('header/userpicture')[picture ? 'show' : 'hide']();
			components.get('header/usericon')[!picture ? 'show' : 'hide']();
			if (picture) {
				components.get('header/userpicture').attr('src', picture);
			}
		});
	}

	function handleImageChange() {

		$('#changePictureBtn').on('click', function() {
			socket.emit('user.getProfilePictures', {uid: ajaxify.data.uid}, function(err, pictures) {
				if (err) {
					return app.alertError(err.message);
				}

				// boolean to signify whether an uploaded picture is present in the pictures list
				var uploaded = pictures.reduce(function(memo, cur) {
					return memo || cur.type === 'uploaded';
				}, false);

				templates.parse('partials/modals/change_picture_modal', {
					pictures: pictures,
					uploaded: uploaded,
					allowProfileImageUploads: ajaxify.data.allowProfileImageUploads
				}, function(html) {
					translator.translate(html, function(html) {
						var modal = bootbox.dialog({
							className: 'picture-switcher',
							title: '[[user:change_picture]]',
							message: html,
							show: true,
							buttons: {
								close: {
									label: '[[global:close]]',
									callback: onCloseModal,
									className: 'btn-link'
								},
								update: {
									label: '[[global:save_changes]]',
									callback: saveSelection
								}
							}
						});

						modal.on('shown.bs.modal', updateImages);
						modal.on('click', '.list-group-item', function selectImageType() {
							modal.find('.list-group-item').removeClass('active');
							$(this).addClass('active');
						});

						handleImageUpload(modal);

						function updateImages() {
							var userIcon = modal.find('.user-icon');

							userIcon
								.css('background-color', ajaxify.data['icon:bgColor'])
								.text(ajaxify.data['icon:text']);

							// Check to see which one is the active picture
							if (!ajaxify.data.picture) {
								modal.find('.list-group-item .user-icon').parents('.list-group-item').addClass('active');
							} else {
								modal.find('.list-group-item img').each(function() {
									if (this.getAttribute('src') === ajaxify.data.picture) {
										$(this).parents('.list-group-item').addClass('active');
									}
								});
							}
						}

						function saveSelection() {
							var type = modal.find('.list-group-item.active').attr('data-type'),
								src = modal.find('.list-group-item.active img').attr('src');
							changeUserPicture(type, function(err) {
								if (err) {
									return app.alertError(err.message);
								}

								updateHeader(type === 'default' ? '' : src);
								ajaxify.refresh();
							});
						}

						function onCloseModal() {
							modal.modal('hide');
						}
					});
				});
			});

			return false;
		});
	}

	function handleAccountDelete() {
		$('#deleteAccountBtn').on('click', function() {
			translator.translate('[[user:delete_account_confirm]]', function(translated) {
				var modal = bootbox.confirm(translated + '<p><input type="text" class="form-control" id="confirm-username" /></p>', function(confirm) {
					if (!confirm) {
						return;
					}

					if ($('#confirm-username').val() !== app.user.username) {
						app.alertError('[[error:invalid-username]]');
						return false;
					} else {
						socket.emit('user.deleteAccount', {}, function(err) {
							if (err) {
								app.alertError(err.message);
							}
							window.location.href = config.relative_path + '/';
						});
					}
				});

				modal.on('shown.bs.modal', function() {
					modal.find('input').focus();
				});
			});
			return false;
		});
	}

	function handleImageUpload(modal) {
		function onUploadComplete(urlOnServer) {
			urlOnServer = urlOnServer + '?' + new Date().getTime();

			updateHeader(urlOnServer);

			if (ajaxify.data.picture.length) {
				$('#user-current-picture, img.avatar').attr('src', urlOnServer);
				uploadedPicture = urlOnServer;
			} else {
				ajaxify.refresh();
			}
		}

		function onRemoveComplete() {
			if (ajaxify.data.uploadedpicture === ajaxify.data.picture) {
				ajaxify.refresh();
				updateHeader();
			}
		}

		modal.find('[data-action="upload"]').on('click', function() {
			modal.modal('hide');

			uploader.show({
				route: config.relative_path + '/api/user/' + ajaxify.data.userslug + '/uploadpicture',
				params: {},
				fileSize: ajaxify.data.maximumProfileImageSize,
				title: '[[user:upload_picture]]',
				description: '[[user:upload_a_picture]]',
				accept: '.png,.jpg,.bmp'
			}, function(imageUrlOnServer) {
				onUploadComplete(imageUrlOnServer);
			});

			return false;
		});

		modal.find('[data-action="upload-url"]').on('click', function() {
			modal.modal('hide');
			templates.parse('partials/modals/upload_picture_from_url_modal', {}, function(html) {
				translator.translate(html, function(html) {
					var uploadModal = $(html);
					uploadModal.modal('show');

					uploadModal.find('.upload-btn').on('click', function() {
						var url = uploadModal.find('#uploadFromUrl').val();
						if (!url) {
							return;
						}
						socket.emit('user.uploadProfileImageFromUrl', {url: url, uid: ajaxify.data.theirid}, function(err, imageUrlOnServer) {
							if (err) {
								return app.alertError(err.message);
							}
							onUploadComplete(imageUrlOnServer);

							uploadModal.modal('hide');
						});

						return false;
					});
				});
			});

			return false;
		});

		modal.find('[data-action="remove-uploaded"]').on('click', function() {
			socket.emit('user.removeUploadedPicture', {uid: ajaxify.data.theirid}, function(err) {
				modal.modal('hide');
				if (err) {
					return app.alertError(err.message);
				}
				onRemoveComplete();
			});
		});
	}

	function handleEmailConfirm() {
		$('#confirm-email').on('click', function() {
			var btn = $(this).attr('disabled', true);
			socket.emit('user.emailConfirm', {}, function(err) {
				btn.removeAttr('disabled');
				if (err) {
					return app.alertError(err.message);
				}
				app.alertSuccess('[[notifications:email-confirm-sent]]');
			});
		});
	}

	function changeUserPicture(type, callback) {
		socket.emit('user.changePicture', {
			type: type,
			uid: ajaxify.data.theirid
		}, callback);
	}

	function getCharsLeft(el, max) {
		return el.length ? '(' + el.val().length + '/' + max + ')' : '';
	}

	function updateSignature() {
		var el = $('#inputSignature');
		$('#signatureCharCountLeft').html(getCharsLeft(el, ajaxify.data.maximumSignatureLength));

		el.on('keyup change', function() {
			$('#signatureCharCountLeft').html(getCharsLeft(el, ajaxify.data.maximumSignatureLength));
		});
	}

	function updateAboutMe() {
		var el = $('#inputAboutMe');
		$('#aboutMeCharCountLeft').html(getCharsLeft(el, ajaxify.data.maximumAboutMeLength));

		el.on('keyup change', function() {
			$('#aboutMeCharCountLeft').html(getCharsLeft(el, ajaxify.data.maximumAboutMeLength));
		});
	}


	return AccountEdit;
});
