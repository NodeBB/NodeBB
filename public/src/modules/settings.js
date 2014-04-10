"use strict";
/* global define, socket, app */

/*
	settings.js 2.0, because version 1:
		- saved everything in "config" hash
		- was hand-rolled (mm, salmon hand roll)
		- Relied on app.config (!!)
	This module should:
		- Allow you to save to any specified hash
		- Rely on jQuery
		- Use sockets
		- Be more awesome
*/

define(function() {
	var Settings = {};

	Settings.load = function(hash, formEl, callback) {
		socket.emit('admin.settings.get', {
			hash: hash
		}, function(err, values) {
			if (!err) {
				$(formEl).deserialize(values);
				if (typeof callback === 'function') {
					callback();
				}
			} else {
				console.log('[settings] Unable to load settings for hash: ', hash);
			}
		});
	};

	Settings.save = function(hash, formEl, callback) {
		formEl = $(formEl);

		if (formEl.length) {
			var	values = formEl.serializeObject();

			// "Fix" checkbox values, so that unchecked options are not omitted
			formEl.find('input[type="checkbox"]').each(function(idx, inputEl) {
				inputEl = $(inputEl);
				if (!inputEl.is(':checked')) {
					values[inputEl.attr('id')] = 'off';
				}
			});

			socket.emit('admin.settings.set', {
				hash: hash,
				values: values
			}, function(err) {
				app.alert({
					title: 'Settings Saved',
					type: 'success',
					timeout: 2500
				});

				if (typeof callback === 'function') {
					callback();
				}
			});
		} else {
			console.log('[settings] Form not found.');
		}
	};

	return Settings;
});
