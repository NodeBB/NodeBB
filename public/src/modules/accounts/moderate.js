'use strict';

define('forum/account/moderate', [
	'benchpress',
	'api',
	'bootbox',
	'alerts',
], function (Benchpress, api, bootbox, alerts) {
	const AccountModerate = {};

	AccountModerate.banAccount = function (theirid, onSuccess) {
		theirid = theirid || ajaxify.data.theirid;

		Benchpress.render('modals/temporary-ban', {}).then(function (html) {
			bootbox.dialog({
				className: 'ban-modal',
				title: '[[user:ban_account]]',
				message: html,
				show: true,
				buttons: {
					close: {
						label: '[[global:close]]',
						className: 'btn-link',
					},
					submit: {
						label: '[[user:ban_account]]',
						callback: function () {
							const formData = $('.ban-modal form').serializeArray().reduce(function (data, cur) {
								data[cur.name] = cur.value;
								return data;
							}, {});

							const until = formData.length > 0 ? (
								Date.now() + (formData.length * 1000 * 60 * 60 * (parseInt(formData.unit, 10) ? 24 : 1))
							) : 0;

							api.put('/users/' + theirid + '/ban', {
								until: until,
								reason: formData.reason || '',
							}).then(() => {
								if (typeof onSuccess === 'function') {
									return onSuccess();
								}

								ajaxify.refresh();
							}).catch(alerts.error);
						},
					},
				},
			});
		});
	};

	AccountModerate.unbanAccount = function (theirid) {
		api.del('/users/' + theirid + '/ban').then(() => {
			ajaxify.refresh();
		}).catch(alerts.error);
	};

	AccountModerate.muteAccount = function (theirid, onSuccess) {
		theirid = theirid || ajaxify.data.theirid;
		Benchpress.render('modals/temporary-mute', {}).then(function (html) {
			bootbox.dialog({
				className: 'mute-modal',
				title: '[[user:mute_account]]',
				message: html,
				show: true,
				buttons: {
					close: {
						label: '[[global:close]]',
						className: 'btn-link',
					},
					submit: {
						label: '[[user:mute_account]]',
						callback: function () {
							const formData = $('.mute-modal form').serializeArray().reduce(function (data, cur) {
								data[cur.name] = cur.value;
								return data;
							}, {});

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
					},
				},
			});
		});
	};

	AccountModerate.unmuteAccount = function (theirid) {
		api.del('/users/' + theirid + '/mute').then(() => {
			ajaxify.refresh();
		}).catch(alerts.error);
	};

	return AccountModerate;
});
