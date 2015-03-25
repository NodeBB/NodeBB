'use strict';

/*global define, socket, app, ajaxify, config*/

define('forum/account/settings', ['forum/account/header'], function(header) {
	var	AccountSettings = {};

	AccountSettings.init = function() {
		header.init();

		$('#submitBtn').on('click', function() {
			var settings = {};

			$('.account').find('input, textarea, select').each(function(id, input) {
				input = $(input);
				var setting = input.attr('data-property');
				if (input.is('select')) {
					settings[setting] = input.val();
					return;
				}

				switch (input.attr('type')) {
					case 'text':
					case 'textarea':
						settings[setting] = input.val();
						break;
					case 'checkbox':
						settings[setting] = input.is(':checked') ? 1 : 0;
						break;
				}
			});

			socket.emit('user.saveSettings', {uid: ajaxify.variables.get('theirid'), settings: settings}, function(err, newSettings) {
				if (err) {
					return app.alertError(err.message);
				}

				app.alertSuccess('[[success:settings-saved]]');
				var requireReload = false;
				for (var key in newSettings) {
					if (newSettings.hasOwnProperty(key)) {
						if (key === 'userLang' && config.userLang !== newSettings.userLang) {
							requireReload = true;
						} 
						config[key] = newSettings[key];	
					}
				}
				app.exposeConfigToTemplates();
				if (requireReload && parseInt(app.user.uid, 10) === parseInt(ajaxify.variables.get('theirid'), 10)) {
					app.alert({
						id: 'setting-change',
						message: '[[user:settings-require-reload]]',
						type: 'warning',
						timeout: 5000,
						clickfn: function() {
							ajaxify.refresh();
						}
					});
				}
			});

			return false;
		});

		socket.emit('user.getSettings', {uid: ajaxify.variables.get('theirid')}, function(err, settings) {
			var inputs = $('.account').find('input, textarea, select');

			inputs.each(function(index, input) {
				input = $(input);
				var setting = input.attr('data-property');
				if (setting) {
					if (input.is('select')) {
						input.val(settings[setting]);
						return;
					}

					switch (input.attr('type')) {
						case 'text' :
						case 'textarea' :
							input.val(settings[setting]);
							break;
						case 'checkbox' :
							input.prop('checked', !!settings[setting]);
							break;
					}
				}
			});
		});
	};

	return AccountSettings;
});
