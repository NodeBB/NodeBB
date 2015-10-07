'use strict';

/* globals define, ajaxify, socket, app, config, utils, bootbox */

define('forum/account/edit', ['forum/account/header', 'uploader', 'translator'], function(header, uploader, translator) {
	var AccountEdit = {},
		uploadedPicture = '',
		selectedImageType = '',
		currentEmail;

	AccountEdit.init = function() {
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

		currentEmail = $('#inputEmail').val();

		handleImageChange();
		handleAccountDelete();
		handleEmailConfirm();
		handlePasswordChange();
		updateSignature();
		updateAboutMe();
	};

	function updateProfile() {
		var userData = {
			uid: $('#inputUID').val(),
			username: $('#inputUsername').val(),
			email: $('#inputEmail').val(),
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

			if (data.userslug) {
				var oldslug = $('.account-username-box').attr('data-userslug');
				$('.account-username-box a').each(function() {
					$(this).attr('href', $(this).attr('href').replace(oldslug, data.userslug));
				});

				$('.account-username-box').attr('data-userslug', data.userslug);
			}

			if (currentEmail !== data.email) {
				currentEmail = data.email;
				$('#confirm-email').removeClass('hide');
			}

			updateHeader(data.picture, userData.username, data.userslug);
		});

		return false;
	}

	function updateHeader(picture, username, userslug) {
		require(['components'], function(components) {
			if (parseInt(ajaxify.data.theirid, 10) !== parseInt(ajaxify.data.yourid, 10)) {
				return;
			}

			components.get('header/userpicture')[picture ? 'show' : 'hide']();
			components.get('header/usericon')[!picture ? 'show' : 'hide']();
			if (picture) {
				components.get('header/userpicture').attr('src', picture);
			}

			if (username && userslug) {
				components.get('header/profilelink').attr('href', config.relative_path + '/user/' + userslug);
				components.get('header/username').text(username);
			}
		});
	}

	function handleImageChange() {

		$('#changePictureBtn').on('click', function() {
			templates.parse('partials/modals/change_picture_modal', {uploadedpicture: uploadedPicture}, function(html) {
				translator.translate(html, function(html) {
					function updateImages() {
						var currentPicture = $('#user-current-picture').attr('src'),
							userIcon = modal.find('.user-icon');

						userIcon
							.css('background-color', ajaxify.data['icon:bgColor'])
							.text(ajaxify.data['icon:text']);

						if (uploadedPicture) {
							console.log("DERP");
							modal.find('#user-uploaded-picture').attr('src', uploadedPicture);
						}

						modal.find('#uploaded-box').toggle(!!uploadedPicture);

						modal.find('#default-box .fa-check').toggle(currentPicture !== uploadedPicture);
						modal.find('#uploaded-box .fa-check').toggle(currentPicture === uploadedPicture);
					}

					function selectImageType(type) {
						modal.find('#default-box .fa-check').toggle(type === 'default');
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

					modal.find('#default-box').on('click', function() {
						selectImageType('default');
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

							updateHeader(selectedImageType === 'uploaded' ? uploadedPicture : '');
							ajaxify.refresh();
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

	function handlePasswordChange() {
		var currentPassword = $('#inputCurrentPassword');
		var password_notify = $('#password-notify');
		var password_confirm_notify = $('#password-confirm-notify');
		var password = $('#inputNewPassword');
		var password_confirm = $('#inputNewPasswordAgain');
		var passwordvalid = false;
		var passwordsmatch = false;

		function onPasswordChanged() {
			if (password.val().length < config.minimumPasswordLength) {
				showError(password_notify, '[[user:change_password_error_length]]');
				passwordvalid = false;
			} else if (!utils.isPasswordValid(password.val())) {
				showError(password_notify, '[[user:change_password_error]]');
				passwordvalid = false;
			} else {
				showSuccess(password_notify);
				passwordvalid = true;
			}
		}

		function onPasswordConfirmChanged() {
			if (password.val() !== password_confirm.val()) {
				showError(password_confirm_notify, '[[user:change_password_error_match]]');
				passwordsmatch = false;
			} else {
				if (password.val()) {
					showSuccess(password_confirm_notify);
				} else {
					password_confirm_notify.parent().removeClass('alert-success alert-danger');
					password_confirm_notify.children().show();
					password_confirm_notify.find('.msg').html('');
				}

				passwordsmatch = true;
			}
		}

		password.on('blur', onPasswordChanged);
		password_confirm.on('blur', onPasswordConfirmChanged);

		$('#changePasswordBtn').on('click', function() {
			onPasswordChanged();
			onPasswordConfirmChanged();

			var btn = $(this);
			if ((passwordvalid && passwordsmatch) || app.user.isAdmin) {
				btn.addClass('disabled').find('i').removeClass('hide');
				socket.emit('user.changePassword', {
					'currentPassword': currentPassword.val(),
					'newPassword': password.val(),
					'uid': ajaxify.data.theirid
				}, function(err) {
					btn.removeClass('disabled').find('i').addClass('hide');
					currentPassword.val('');
					password.val('');
					password_confirm.val('');
					passwordsmatch = false;
					passwordvalid = false;

					if (err) {
						onPasswordChanged();
						onPasswordConfirmChanged();
						return app.alertError(err.message);
					}

					app.alertSuccess('[[user:change_password_success]]');
				});
			} else {
				if (!passwordsmatch) {
					app.alertError('[[user:change_password_error_match]]');
				}

				if (!passwordvalid) {
					app.alertError('[[user:change_password_error]]');
				}
			}
			return false;
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

	function showError(element, msg) {
		translator.translate(msg, function(msg) {
			element.find('.error').html(msg).removeClass('hide').siblings().addClass('hide');

			element.parent()
				.removeClass('alert-success')
				.addClass('alert-danger');
			element.show();
		});
	}

	function showSuccess(element) {
		element.find('.success').removeClass('hide').siblings().addClass('hide');
		element.parent()
			.removeClass('alert-danger')
			.addClass('alert-success');
		element.show();
	}

	return AccountEdit;
});