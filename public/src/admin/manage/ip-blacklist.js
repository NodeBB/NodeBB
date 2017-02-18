'use strict';


define('admin/manage/ip-blacklist', ['translator'], function (translator) {

	var Blacklist = {};

	Blacklist.init = function () {
		var blacklist = $('#blacklist-rules');

		blacklist.on('keyup', function () {
		    $('#blacklist-rules-holder').val(blacklist.val());
		});

		$('[data-action="apply"]').on('click', function () {
			socket.emit('blacklist.save', blacklist.val(), function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alert({
					type: 'success',
					alert_id: 'blacklist-saved',
					title: '[[admin/manage/ip-blacklist:alerts.applied-success]]',
				});
			});
		});

		$('[data-action="test"]').on('click', function () {
			socket.emit('blacklist.validate', {
				rules: blacklist.val(),
			}, function (err, data) {
				if (err) {
					return app.alertError(err.message);
				}

				templates.parse('admin/partials/blacklist-validate', data, function (html) {
					bootbox.alert(html);
				});
			});
		});
	};

	return Blacklist;
});
