'use strict';

define('forum/account/edit', [
	'forum/account/header',
	'accounts/picture',
	'translator',
	'api',
	'hooks',
	'bootbox',
	'alerts',
], function (header, picture, translator, api, hooks, bootbox, alerts) {
	const AccountEdit = {};

	AccountEdit.init = function () {
		header.init();

		$('#submitBtn').on('click', updateProfile);

		app.loadJQueryUI(function () {
			$('#inputBirthday').datepicker({
				changeMonth: true,
				changeYear: true,
				yearRange: '1900:-5y',
				defaultDate: '-13y',
			});
		});

		if (ajaxify.data.groupTitleArray.length === 1 && ajaxify.data.groupTitleArray[0] === '') {
			$('#groupTitle option[value=""]').attr('selected', true);
		}

		handleImageChange();
		handleAccountDelete();
		handleEmailConfirm();
		updateSignature();
		updateAboutMe();
		handleGroupSort();
	};

	function updateProfile() {
		const userData = $('form[component="profile/edit/form"]').serializeObject();
		userData.uid = ajaxify.data.uid;
		userData.groupTitle = userData.groupTitle || '';
		userData.groupTitle = JSON.stringify(
			Array.isArray(userData.groupTitle) ? userData.groupTitle : [userData.groupTitle]
		);

		hooks.fire('action:profile.update', userData);

		api.put('/users/' + userData.uid, userData).then((res) => {
			alerts.success('[[user:profile_update_success]]');

			if (res.picture) {
				$('#user-current-picture').attr('src', res.picture);
			}

			picture.updateHeader(res.picture);
		}).catch(alerts.error);

		return false;
	}

	function handleImageChange() {
		$('#changePictureBtn').on('click', function () {
			picture.openChangeModal();
			return false;
		});
	}

	function handleAccountDelete() {
		$('#deleteAccountBtn').on('click', function () {
			translator.translate('[[user:delete_account_confirm]]', function (translated) {
				const modal = bootbox.confirm(translated + '<p><input type="password" class="form-control" id="confirm-password" /></p>', function (confirm) {
					if (!confirm) {
						return;
					}

					const confirmBtn = modal.find('.btn-primary');
					confirmBtn.html('<i class="fa fa-spinner fa-spin"></i>');
					confirmBtn.prop('disabled', true);

					socket.emit('user.deleteAccount', {
						password: $('#confirm-password').val(),
					}, function (err) {
						function restoreButton() {
							translator.translate('[[modules:bootbox.confirm]]', function (confirmText) {
								confirmBtn.text(confirmText);
								confirmBtn.prop('disabled', false);
							});
						}

						if (err) {
							restoreButton();
							return alerts.error(err);
						}

						confirmBtn.html('<i class="fa fa-check"></i>');
						require(['logout'], function (logout) {
							logout();
						});
					});

					return false;
				});

				modal.on('shown.bs.modal', function () {
					modal.find('input').focus();
				});
			});
			return false;
		});
	}

	function handleEmailConfirm() {
		$('#confirm-email').on('click', function () {
			const btn = $(this).attr('disabled', true);
			socket.emit('user.emailConfirm', {}, function (err) {
				btn.removeAttr('disabled');
				if (err) {
					return alerts.error(err);
				}
				alerts.success('[[notifications:email-confirm-sent]]');
			});
		});
	}

	function getCharsLeft(el, max) {
		return el.length ? '(' + el.val().length + '/' + max + ')' : '';
	}

	function updateSignature() {
		const el = $('#signature');
		$('#signatureCharCountLeft').html(getCharsLeft(el, ajaxify.data.maximumSignatureLength));

		el.on('keyup change', function () {
			$('#signatureCharCountLeft').html(getCharsLeft(el, ajaxify.data.maximumSignatureLength));
		});
	}

	function updateAboutMe() {
		const el = $('#aboutme');
		$('#aboutMeCharCountLeft').html(getCharsLeft(el, ajaxify.data.maximumAboutMeLength));

		el.on('keyup change', function () {
			$('#aboutMeCharCountLeft').html(getCharsLeft(el, ajaxify.data.maximumAboutMeLength));
		});
	}

	function handleGroupSort() {
		function move(direction) {
			const selected = $('#groupTitle').val();
			if (!ajaxify.data.allowMultipleBadges || (Array.isArray(selected) && selected.length > 1)) {
				return;
			}
			const el = $('#groupTitle').find(':selected');
			if (el.length && el.val()) {
				if (direction > 0) {
					el.insertAfter(el.next());
				} else if (el.prev().val()) {
					el.insertBefore(el.prev());
				}
			}
		}
		$('[component="group/order/up"]').on('click', function () {
			move(-1);
		});
		$('[component="group/order/down"]').on('click', function () {
			move(1);
		});
	}

	return AccountEdit;
});
