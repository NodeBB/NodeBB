'use strict';

/* globals define, ajaxify, socket, app, config, templates, bootbox */

define('forum/account/edit', ['forum/account/header', 'uploader', 'translator'], function(header, uploader, translator) {
	var AccountEdit = {},
		gravatarPicture = '',
		uploadedPicture = '',
		selectedImageType = '';

	AccountEdit.init = function() {
		gravatarPicture = ajaxify.data.gravatarpicture;
		uploadedPicture = ajaxify.data.uploadedpicture;

		header.init();

		$('#submitBtn').on('click', updateProfile);

		app.loadJQueryUI(function() {
			$('#inputBirthday').datepicker({
				changeMonth: true,
				changeYear: true,
				yearRange: '1900:+0'
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

			if (data.gravatarpicture) {
				$('#user-gravatar-picture').attr('src', data.gravatarpicture);
				gravatarPicture = data.gravatarpicture;
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

			if (picture) {
				components.get('header/userpicture').attr('src', picture);
			}
		});
	}

	function handleImageChange() {

		$('#changePictureBtn').on('click', function() {
			templates.parse('partials/modals/change_picture_modal', {uploadedpicture: uploadedPicture}, function(html) {
				translator.translate(html, function(html) {
					function updateImages() {
						var currentPicture = $('#user-current-picture').attr('src');

						if (gravatarPicture) {
							modal.find('#user-gravatar-picture').attr('src', gravatarPicture);
						}

						if (uploadedPicture) {
							modal.find('#user-uploaded-picture').attr('src', uploadedPicture);
						}

						modal.find('#gravatar-box').toggle(!!gravatarPicture);
						modal.find('#uploaded-box').toggle(!!uploadedPicture);

						modal.find('#gravatar-box .fa-check').toggle(currentPicture !== uploadedPicture);
						modal.find('#uploaded-box .fa-check').toggle(currentPicture === uploadedPicture);
					}

					function selectImageType(type) {
						modal.find('#gravatar-box .fa-check').toggle(type === 'gravatar');
						modal.find('#uploaded-box .fa-check').toggle(type === 'uploaded');
						selectedImageType = type;
					}

					var modal = $(html);
					modal.on('hidden.bs.modal', function() {
						modal.remove();
					});
					selectedImageType = '';
					updateImages();

					modal.modal('show');

					modal.find('#gravatar-box').on('click', function() {
						selectImageType('gravatar');
					});

					modal.find('#uploaded-box').on('click', function() {
						selectImageType('uploaded');
					});

					handleImageUpload(modal);

					modal.find('#savePictureChangesBtn').on('click', function() {

						modal.modal('hide');

						if (!selectedImageType) {
							return;
						}
						changeUserPicture(selectedImageType, function(err) {
							if (err) {
								return app.alertError(err.message);
							}

							if (selectedImageType === 'gravatar') {
								$('#user-current-picture').attr('src', gravatarPicture);
								updateHeader(gravatarPicture);
							} else if (selectedImageType === 'uploaded') {
								$('#user-current-picture').attr('src', uploadedPicture);
								updateHeader(uploadedPicture);
							}
						});
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

			$('#user-current-picture').attr('src', urlOnServer);
			updateHeader(urlOnServer);
			uploadedPicture = urlOnServer;
		}

		function onRemoveComplete(urlOnServer) {
			$('#user-current-picture').attr('src', urlOnServer);
			updateHeader(urlOnServer);
			uploadedPicture = '';
		}

		modal.find('#uploadPictureBtn').on('click', function() {
			modal.modal('hide');
			uploader.open(config.relative_path + '/api/user/' + ajaxify.data.userslug + '/uploadpicture', {}, config.maximumProfileImageSize, function(imageUrlOnServer) {
				onUploadComplete(imageUrlOnServer);
			});

			return false;
		});

		modal.find('#uploadFromUrlBtn').on('click', function() {
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

		modal.find('#removeUploadedPictureBtn').on('click', function() {
			socket.emit('user.removeUploadedPicture', {uid: ajaxify.data.theirid}, function(err, imageUrlOnServer) {
				modal.modal('hide');
				if (err) {
					return app.alertError(err.message);
				}
				onRemoveComplete(imageUrlOnServer);
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
		$('#signatureCharCountLeft').html(getCharsLeft(el, config.maximumSignatureLength));

		el.on('keyup change', function() {
			$('#signatureCharCountLeft').html(getCharsLeft(el, config.maximumSignatureLength));
		});
	}

	function updateAboutMe() {
		var el = $('#inputAboutMe');
		$('#aboutMeCharCountLeft').html(getCharsLeft(el, config.maximumAboutMeLength));

		el.on('keyup change', function() {
			$('#aboutMeCharCountLeft').html(getCharsLeft(el, config.maximumAboutMeLength));
		});
	}


	return AccountEdit;
});
