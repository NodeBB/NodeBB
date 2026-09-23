'use strict';


define('settings', ['hooks', 'alerts'], function (hooks, alerts) {
	const helper = {
		serializeForm: function (formEl) {
			const values = formEl.serializeObject();

			// "Fix" checkbox values, so that unchecked options are not omitted
			formEl.find('input[type="checkbox"]').each(function (idx, inputEl) {
				inputEl = $(inputEl);
				if (!inputEl.is(':checked')) {
					values[inputEl.attr('name')] = 'off';
				}
			});

			// save multiple selects as json arrays
			formEl.find('select[multiple]').each(function (idx, selectEl) {
				selectEl = $(selectEl);
				values[selectEl.attr('name')] = JSON.stringify(selectEl.val());
			});

			return values;
		},
	};

	const Settings = {
		helper: helper,

		load: function (hash, formEl, callback) {
			callback = callback || function () {};
			const call = formEl.attr('data-socket-get');

			socket.emit(call || 'admin.settings.get', {
				hash: hash,
			}, function (err, values) {
				if (err) {
					return callback(err);
				}
				// multipe selects are saved as json arrays, parse them here
				$(formEl).find('select[multiple]').each(function (idx, selectEl) {
					const key = $(selectEl).attr('name');
					if (key && values.hasOwnProperty(key)) {
						try {
							values[key] = JSON.parse(values[key]);
						} catch (err) {
							console.error(err);
						}
					}
				});

				// Save loaded settings into ajaxify.data for use client-side
				ajaxify.data[call ? hash : 'settings'] = values;

				$(formEl).deserialize(values);
				hooks.fire('action:admin.settingsLoaded');

				// Handle unsaved changes
				$(formEl).on('change', 'input, select, textarea', function () {
					app.flags = app.flags || {};
					app.flags._unsaved = true;
				});

				const saveEl = document.getElementById('save');
				if (saveEl) {
					require(['mousetrap'], function (mousetrap) {
						mousetrap.bind('ctrl+s', function (ev) {
							saveEl.click();
							ev.preventDefault();
						});
					});
				}

				callback(null, values);
			});
		},
		save: function (hash, formEl, callback) {
			formEl = $(formEl);

			const controls = formEl.get(0).elements;
			const ok = Settings.check(controls);
			if (!ok) {
				return;
			}

			if (formEl.length) {
				const values = helper.serializeForm(formEl);

				const call = formEl.attr('data-socket-set');
				socket.emit(call || 'admin.settings.set', {
					hash: hash,
					values: values,
				}, function (err) {
					// Remove unsaved flag to re-enable ajaxify
					app.flags._unsaved = false;

					// Also save to local ajaxify.data
					ajaxify.data[call ? hash : 'settings'] = values;

					if (typeof callback === 'function') {
						callback(err);
					} else if (err) {
						alerts.alert({
							title: '[[admin/admin:changes-not-saved]]',
							message: `[[admin/admin/changes-not-saved-message, ${err.message}]]`,
							type: 'error',
							timeout: 5000,
						});
					} else {
						const saveBtn = document.getElementById('save');
						saveBtn.classList.toggle('saved', true);
						setTimeout(() => {
							saveBtn.classList.toggle('saved', false);
						}, 1500);
					}
				});
			}
		},
		check: function (controls) {
			const onTrigger = (e) => {
				const wrapper = e.target.closest('.form-group');
				if (wrapper) {
					wrapper.classList.add('has-error');
				}

				e.target.removeEventListener('invalid', onTrigger);
			};

			return Array.prototype.map.call(controls, (controlEl) => {
				const wrapper = controlEl.closest('.form-group');
				if (wrapper) {
					wrapper.classList.remove('has-error');
				}

				controlEl.addEventListener('invalid', onTrigger);
				return controlEl.reportValidity();
			}).every(Boolean);
		},
	};

	return Settings;
});
