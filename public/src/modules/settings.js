'use strict';


define('settings', ['hooks', 'alerts'], function (hooks, alerts) {
	let onReady = [];
	let waitingJobs = 0;

	/**
	 Returns the hook of given name that matches the given type or element.
	 @param type The type of the element to get the matching hook for, or the element itself.
	 @param name The name of the hook.
	 */
	function getHook(type, name) {
		if (typeof type !== 'string') {
			type = $(type);
			type = type.data('type') || type.attr('type') || type.prop('tagName');
		}
		const plugin = Settings.plugins[type.toLowerCase()];
		if (plugin == null) {
			return;
		}
		const hook = plugin[name];
		if (typeof hook === 'function') {
			return hook;
		}
		return null;
	}

	const helper = {
		/**
		 Increases the amount of jobs before settings are ready by given amount.
		 @param amount The amount of jobs to register.
		 */
		registerReadyJobs: function (amount) {
			waitingJobs += amount;
			return waitingJobs;
		},
		/**
		 Decreases the amount of jobs before settings are ready by given amount or 1.
		 If the amount is less or equal 0 all callbacks registered by {@link helper.whenReady} get called.
		 @param amount The amount of jobs that finished.
		 */
		beforeReadyJobsDecreased: function (amount) {
			if (amount == null) {
				amount = 1;
			}
			if (waitingJobs > 0) {
				waitingJobs -= amount;
				if (waitingJobs <= 0) {
					for (let i = 0; i < onReady.length; i += 1) {
						onReady[i]();
					}
					onReady = [];
				}
			}
		},
		/**
		 Calls the given callback when the settings are ready.
		 @param callback The callback.
		 */
		whenReady: function (callback) {
			if (waitingJobs <= 0) {
				callback();
			} else {
				onReady.push(callback);
			}
		},
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
		plugins: {},

		/**
		 Registers a new plugin and calls its use-hook.
		 @param service The plugin to register.
		 @param types The types to bind the plugin to.
		 */
		registerPlugin: function (service, types) {
			if (types == null) {
				types = service.types;
			} else {
				service.types = types;
			}
			if (typeof service.use === 'function') {
				service.use.call(Settings);
			}
			for (let i = 0; i < types.length; i += 1) {
				const type = types[i].toLowerCase();
				if (Settings.plugins[type] == null) {
					Settings.plugins[type] = service;
				}
			}
		},
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

				helper.whenReady(function () {
					$(formEl).find('[data-sorted-list]').each(function (idx, el) {
						getHook(el, 'get').call(Settings, $(el), hash);
					});
				});

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

				helper.whenReady(function () {
					const list = formEl.find('[data-sorted-list]');
					if (list.length) {
						list.each((idx, item) => {
							getHook(item, 'set').call(Settings, $(item), values);
						});
					}
				});

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


	helper.registerReadyJobs(1);
	require([
		'settings/sorted-list',
	], function () {
		for (let i = 0; i < arguments.length; i += 1) {
			Settings.registerPlugin(arguments[i]);
		}
		helper.beforeReadyJobsDecreased();
	});

	return Settings;
});
