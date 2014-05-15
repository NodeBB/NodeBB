"use strict";
/*global define, app, socket, RELATIVE_PATH */

define(['uploader', 'sounds'], function(uploader, sounds) {
	var Settings = {};

	Settings.init = function() {
		Settings.prepare();
	};

	Settings.prepare = function(callback) {
		// Come back in 125ms if the config isn't ready yet
		if (!app.config) {
			setTimeout(function() {
				Settings.prepare(callback);
			}, 125);
			return;
		}

		// Populate the fields on the page from the config
		var fields = $('#content [data-field]'),
			numFields = fields.length,
			saveBtn = $('#save'),
			x, key, inputType, field;

		for (x = 0; x < numFields; x++) {
			field = fields.eq(x);
			key = field.attr('data-field');
			inputType = field.attr('type');
			if (field.is('input')) {
				if (app.config[key]) {
					switch (inputType) {
					case 'text':
					case 'password':
					case 'textarea':
					case 'number':
						field.val(app.config[key]);
						break;

					case 'checkbox':
						field.prop('checked', parseInt(app.config[key], 10) === 1);
						break;
					}
				}
			} else if (field.is('textarea')) {
				if (app.config[key]) {
					field.val(app.config[key]);
				}
			} else if (field.is('select')) {
				if (app.config[key]) {
					field.val(app.config[key]);
				}
			}
		}

		saveBtn.on('click', function(e) {
			e.preventDefault();

			for (x = 0; x < numFields; x++) {
				saveField(fields[x]);
			}
		});

		$('#uploadLogoBtn').on('click', function() {
			uploader.open(RELATIVE_PATH + '/admin/uploadlogo', {}, 0, function(image) {
				$('#logoUrl').val(image);
			});

			uploader.hideAlerts();
		});

		$('#uploadFaviconBtn').on('click', function() {
			uploader.open(RELATIVE_PATH + '/admin/uploadfavicon', {}, 0, function(icon) {
				$('#faviconUrl').val(icon);
			});

			uploader.hideAlerts();
		});

		$('#settings-tab a').click(function (e) {
			e.preventDefault();
			$(this).tab('show');
			return false;
		});

		if (typeof callback === 'function') {
			callback();
		}
	};

	Settings.remove = function(key) {
		socket.emit('admin.config.remove', key);
	};

	function saveField(field) {
		field = $(field);
		var key = field.attr('data-field'),
			value, inputType;

		if (field.is('input')) {
			inputType = field.attr('type');
			switch (inputType) {
			case 'text':
			case 'password':
			case 'textarea':
			case 'number':
				value = field.val();
				break;

			case 'checkbox':
				value = field.prop('checked') ? '1' : '0';
				break;
			}
		} else if (field.is('textarea') || field.is('select')) {
			value = field.val();
		}

		socket.emit('admin.config.set', {
			key: key,
			value: value
		}, function(err) {
			if(err) {
				return app.alert({
					alert_id: 'config_status',
					timeout: 2500,
					title: 'Changes Not Saved',
					message: 'NodeBB encountered a problem saving your changes',
					type: 'danger'
				});
			}

			if(app.config[key] !== undefined) {
				app.config[key] = value;
			}

			app.alert({
				alert_id: 'config_status',
				timeout: 2500,
				title: 'Changes Saved',
				message: 'Your changes to the NodeBB configuration have been saved.',
				type: 'success'
			});

		});
	}

	return Settings;
});
