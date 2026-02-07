'use strict';

define('forum/account/moderate', [
	'api',
	'bootbox',
	'alerts',
	'translator',
], function (api, bootbox, alerts, translator) {
	const AccountModerate = {};

	AccountModerate.banAccount = function (theirid, onSuccess) {
		theirid = theirid || ajaxify.data.theirid;

		throwModal({
			tpl: 'modals/temporary-ban',
			title: '[[user:ban-account]]',
			onSubmit: function (formData) {
				const until = formData.length > 0 ? (
					Date.now() + (formData.length * 1000 * 60 * 60 * (parseInt(formData.unit, 10) ? 24 : 1))
				) : 0;
				api.put('/users/' + encodeURIComponent(theirid) + '/ban', {
					until: until,
					reason: formData.reason || '',
				}).then(() => {
					if (typeof onSuccess === 'function') {
						return onSuccess();
					}

					ajaxify.refresh();
				}).catch(alerts.error);
			},
		});
	};

	AccountModerate.unbanAccount = function (theirid) {
		throwModal({
			tpl: 'modals/unban',
			title: '[[user:unban-account]]',
			onSubmit: function (formData) {
				api.del('/users/' + encodeURIComponent(theirid) + '/ban', {
					reason: formData.reason || '',
				}).then(() => {
					ajaxify.refresh();
				}).catch(alerts.error);
			},
		});
	};

	AccountModerate.muteAccount = function (theirid, onSuccess) {
		theirid = theirid || ajaxify.data.theirid;
		throwModal({
			tpl: 'modals/temporary-mute',
			title: '[[user:mute-account]]',
			onSubmit: function (formData) {
				const until = formData.length > 0 ? (
					Date.now() + (formData.length * 1000 * 60 * 60 * (parseInt(formData.unit, 10) ? 24 : 1))
				) : 0;

				api.put('/users/' + theirid + '/mute', {
					until: until,
					reason: formData.reason || '',
				}).then(() => {
					if (typeof onSuccess === 'function') {
						return onSuccess();
					}
					ajaxify.refresh();
				}).catch(alerts.error);
			},
		});
	};

	AccountModerate.unmuteAccount = function (theirid) {
		throwModal({
			tpl: 'modals/unmute',
			title: '[[user:unmute-account]]',
			onSubmit: function (formData) {
				api.del('/users/' + theirid + '/mute', {
					reason: formData.reason || '',
				}).then(() => {
					ajaxify.refresh();
				}).catch(alerts.error);
			},
		});
	};

	async function throwModal(options) {
		const reasons = await socket.emit('user.getBanReasons');
		const html = await app.parseAndTranslate(options.tpl, { reasons });
		const modal = bootbox.dialog({
			title: options.title,
			message: html,
			show: true,
			onEscape: true,
			buttons: {
				close: {
					label: '[[global:close]]',
					className: 'btn-link',
				},
				submit: {
					label: options.title,
					callback: function () {
						const formData = modal.find('form').serializeArray().reduce(function (data, cur) {
							data[cur.name] = cur.value;
							return data;
						}, {});

						options.onSubmit(formData);
					},
				},
			},
		});
		modal.find('[data-key]').on('click', function () {
			const reason = reasons.find(r => String(r.key) === $(this).attr('data-key'));
			if (reason && reason.body) {
				modal.find('[name="reason"]').val(translator.unescape(reason.body));
			}
		});
	}

	return AccountModerate;
});
