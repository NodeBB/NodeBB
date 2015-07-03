"use strict";

/* global config, socket, define, templates, bootbox, app, ajaxify,  */

define('admin/manage/registration', function() {
	var Registration = {};

	Registration.init = function() {

		$('.users-list').on('click', '[data-action]', function(ev) {
			var $this = this;
			var parent = $(this).parents('[data-username]');
			var action = $(this).attr('data-action');
			var username = parent.attr('data-username');
			var method = action === 'accept' ? 'admin.user.acceptRegistration' : 'admin.user.rejectRegistration';

			socket.emit(method, {username: username}, function(err) {
				if (err) {
					return app.alertError(err.message);
				}
				parent.remove();
			});
			return false;
		});
	};

	return Registration;
});
