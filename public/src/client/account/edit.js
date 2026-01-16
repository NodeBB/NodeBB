'use strict';

define('forum/account/edit', [
	'forum/account/header',
	'accounts/picture',
	'translator',
	'api',
	'hooks',
	'bootbox',
	'alerts',
	'admin/modules/change-email',
], function (header, picture, translator, api, hooks, bootbox, alerts, changeEmail) {
	const AccountEdit = {};

	AccountEdit.init = function () {
		header.init();

		$('#submitBtn').on('click', updateProfile);

		if (ajaxify.data.groupTitleArray.length === 1 && ajaxify.data.groupTitleArray[0] === '') {
			$('#groupTitle option[value=""]').attr('selected', true);
		}

		handleAccountDelete();
		handleEmailConfirm();
		updateSignature();
		updateAboutMe();
		handleGroupControls();

		if (!ajaxify.data.isSelf && ajaxify.data.canEdit) {
			$(`a[href="${config.relative_path}/user/${ajaxify.data.userslug}/edit/email"]`).on('click', () => {
				changeEmail.init({
					uid: ajaxify.data.uid,
					email: ajaxify.data.email,
					onSuccess: function () {
						alerts.success('[[user:email-updated]]');
					},
				});
				return false;
			});
		}
	};

	function updateProfile() {
		function getGroupSelection() {
			const els = $('[component="group/badge/list"] [component="group/badge/item"][data-selected="true"]');
			return els.map((i, el) => $(el).attr('data-value')).get();
		}
		const editForm = $('form[component="profile/edit/form"]');
		const userData = editForm.serializeObject();

		// stringify multi selects
		editForm.find('select[multiple]').each((i, el) => {
			const name = $(el).attr('name');
			if (userData[name] && !Array.isArray(userData[name])) {
				userData[name] = [userData[name]];
			}
			userData[name] = JSON.stringify(userData[name] || []);
		});

		userData.uid = ajaxify.data.uid;
		userData.groupTitle = userData.groupTitle || '';
		userData.groupTitle = JSON.stringify(getGroupSelection());

		hooks.fire('action:profile.update', userData);

		api.put('/users/' + userData.uid, userData).then((res) => {
			alerts.success('[[user:profile-update-success]]');

			if (res.picture) {
				$('#user-current-picture').attr('src', res.picture);
			}

			picture.updateHeader(res.picture);
		}).catch(alerts.error);

		return false;
	}



	function handleAccountDelete() {
		$('#deleteAccountBtn').on('click', function () {
			translator.translate('[[user:delete-account-confirm]]', function (translated) {
				const modal = bootbox.confirm(translated + '<p><input type="password" class="form-control" id="confirm-password" /></p>', function (confirm) {
					if (!confirm) {
						return;
					}

					const confirmBtn = modal.find('.btn-primary');
					confirmBtn.html('<i class="fa fa-spinner fa-spin"></i>');
					confirmBtn.prop('disabled', true);
					api.del(`/users/${ajaxify.data.uid}/account`, {
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
						window.location.href = `${config.relative_path}/`;
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

	function handleGroupControls() {
		const { allowMultipleBadges } = ajaxify.data;
		$('[component="group/toggle/hide"]').on('click', function () {
			const groupEl = $(this).parents('[component="group/badge/item"]');
			groupEl.attr('data-selected', 'false');
			$(this).addClass('hidden');
			groupEl.find('[component="group/toggle/show"]').removeClass('hidden');
		});

		$('[component="group/toggle/show"]').on('click', function () {
			if (!allowMultipleBadges) {
				$('[component="group/badge/list"] [component="group/toggle/show"]').removeClass('hidden');
				$('[component="group/badge/list"] [component="group/toggle/hide"]').addClass('hidden');
				$('[component="group/badge/list"] [component="group/badge/item"]').attr('data-selected', 'false');
			}
			const groupEl = $(this).parents('[component="group/badge/item"]');
			groupEl.attr('data-selected', 'true');
			$(this).addClass('hidden');
			groupEl.find('[component="group/toggle/hide"]').removeClass('hidden');
		});

		$('[component="group/order/up"]').on('click', function () {
			const el = $(this).parents('[component="group/badge/item"]');
			el.insertBefore(el.prev());
		});
		$('[component="group/order/down"]').on('click', function () {
			const el = $(this).parents('[component="group/badge/item"]');
			el.insertAfter(el.next());
		});
	}

	return AccountEdit;
});
