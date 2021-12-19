'use strict';


define('forum/account/consent', ['forum/account/header', 'alerts'], function (header, alerts) {
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

		handleExport($('[data-action="export-profile"]'), 'user.exportProfile', '[[user:consent.export-profile-success]]');
		handleExport($('[data-action="export-posts"]'), 'user.exportPosts', '[[user:consent.export-posts-success]]');
		handleExport($('[data-action="export-uploads"]'), 'user.exportUploads', '[[user:consent.export-uploads-success]]');

		function handleExport(el, method, success) {
			el.on('click', function () {
				socket.emit(method, { uid: ajaxify.data.uid }, function (err) {
					if (err) {
						return alerts.error(err);
					}
					alerts.success(success);
				});
			});
		}
	};

	return Consent;
});
