'use strict';
/* globals $, app, socket, templates, define, bootbox */

define('admin/manage/ip-blacklist', [], function() {

	var Blacklist = {};

	Blacklist.init = function() {
		var blacklist = $('#blacklist-rules');

		blacklist.on('keyup', function() {
		    $('#blacklist-rules-holder').val(blacklist.val());
		});

		$('[data-action="apply"]').on('click', function() {
			socket.emit('blacklist.save', blacklist.val(), function(err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alert({
					type: 'success',
					alert_id: 'blacklist-saved',
					title: 'Blacklist Applied',
				});
			});
		});

		$('[data-action="test"]').on('click', function() {
			socket.emit('blacklist.validate', {
				rules: blacklist.val()
			}, function(err, data) {
				templates.parse('admin/partials/blacklist-validate', data, function(html) {
					bootbox.alert(html);
				});
			});
		});
	};

	return Blacklist;
});