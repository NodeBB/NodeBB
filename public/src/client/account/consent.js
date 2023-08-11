'use strict';


define('forum/account/consent', ['forum/account/header', 'alerts', 'api'], function (header, alerts, api) {
	const Consent = {};

	Consent.init = function () {
		header.init();

		$('[data-action="consent"]').on('click', function () {
			socket.emit('user.gdpr.consent', {}, function (err) {
				if (err) {
					return alerts.error(err);
				}

				ajaxify.refresh();
			});
		});

		handleExport($('[data-action="export-profile"]'), 'profile', '[[user:consent.export-profile-success]]');
		handleExport($('[data-action="export-posts"]'), 'posts', '[[user:consent.export-posts-success]]');
		handleExport($('[data-action="export-uploads"]'), 'uploads', '[[user:consent.export-uploads-success]]');

		function handleExport(el, type, success) {
			el.on('click', function () {
				api.post(`/users/${ajaxify.data.uid}/exports/${type}`).then(() => {
					alerts.success(success);
				}).catch(alerts.error);
			});
		}
	};

	return Consent;
});
