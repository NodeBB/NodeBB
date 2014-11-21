"use strict";
/*global define, app, socket*/

define('settings', function () {

	var DEFAULT_PLUGINS = [
		'settings/checkbox',
		'settings/number',
		'settings/textarea',
		'settings/select',
		'settings/array',
		'settings/key'
	];

	var Settings,
		onReady = [],
		waitingJobs = 0,
		helper;

	/**
	 Returns the hook of given name that matches the given type or element.
	 @param type The type of the element to get the matching hook for, or the element itself.
	 @param name The name of the hook.
	 */
	function getHook(type, name) {
		var hook, plugin;
		if (typeof type !== 'string') {
			type = $(type);
			type = type.data('type') || type.attr('type') || type.prop('tagName');
		}
		plugin = Settings.plugins[type.toLowerCase()];
		if (plugin == null) {
			return void 0;
		}
		hook = plugin[name];
		if (typeof hook === 'function') {
			return hook;
		} else {
			return null;
		}
	}

	helper = {
		/**
		 @returns Object A deep clone of the given object.
		 */
		deepClone: function (obj) {
			if (typeof obj === 'object') {
				return JSON.parse(JSON.stringify(obj));
			} else {
				return obj;
			}
		},
		/**
		 Creates a new Element with given data.
		 @param tagName The tag-name of the element to create.
		 @param data The attributes to set.
		 @param text The text to add into the element.
		 @returns HTMLElement The created element.
		 */
		createElement: function (tagName, data, text) {
			var element = document.createElement(tagName);
			for (var k in data) {
				if (data.hasOwnProperty(k)) {
					element.setAttribute(k, data[k]);
				}
			}
			if (text) {
				element.appendChild(document.createTextNode(text));
			}
			return element;
		},
		/**
		 Calls the init-hook of the given element.
		 @param element The element to initialize.
		 */
		initElement: function (element) {
			var hook = getHook(element, 'init');
			if (hook != null) {
				hook.call(Settings, $(element));
			}
		},
		/**
		 Calls the destruct-hook of the given element.
		 @param element The element to destruct.
		 */
		destructElement: function (element) {
			var hook = getHook(element, 'destruct');
			if (hook != null) {
				hook.call(Settings, $(element));
			}
		},
		/**
		 Creates and initializes a new element.
		 @param type The type of the new element.
		 @param tagName The tag-name of the new element.
		 @param data The data to forward to create-hook or use as attributes.
		 @returns JQuery The created element.
		 */
		createElementOfType: function (type, tagName, data) {
			var element, hook = getHook(type, 'create');
			if (hook != null) {
				element = $(hook.call(Settings, type, tagName, data));
			} else {
				if (data == null) {
					data = {};
				}
				if (type != null) {
					data.type = type;
				}
				element = $(helper.createElement(tagName || 'input', data));
			}
			element.data('type', type);
			helper.initElement(element);
			return element;
		},
		/**
		 Creates a new Array that contains values of given Array depending on trim and empty.
		 @param array The array to clean.
		 @param trim Whether to trim each value if it has a trim-function.
		 @param empty Whether empty values should get added.
		 @returns Array The filtered and/or modified Array.
		 */
		cleanArray: function (array, trim, empty) {
			var cleaned = [];
			if (!trim && empty) {
				return array;
			}
			for (var i = 0; i < array.length; i++) {
				var value = array[i];
				if (trim) {
					value = value === true ? 1 : value === false ? 0 : typeof value.trim === 'function' ? value.trim() : value;
				}
				if (empty || (value != null ? value.length : void 0)) {
					cleaned.push(value);
				}
			}
			return cleaned;
		},
		isTrue: function (value) {
			return value === 'true' || +value === 1;
		},
		isFalse: function (value) {
			return value === 'false' || +value === 0;
		},
		/**
		 Calls the get-hook of the given element and returns its result.
		 If no hook is specified it gets treated as input-field.
		 @param element The element of that the value should get read.
		 @returns Object The value of the element.
		 */
		readValue: function (element) {
			var empty = !helper.isFalse(element.data('empty')),
				trim = !helper.isFalse(element.data('trim')),
				split = element.data('split'),
				hook = getHook(element, 'get'),
				value;
			if (hook != null) {
				return hook.call(Settings, element, trim, empty);
			}
			if (split != null) {
				empty = helper.isTrue(element.data('empty')); // default empty-value is false for arrays
				value = element.val();
				var array = (value != null ? value.split(split || ',') : void 0) || [];
				return helper.cleanArray(array, trim, empty);
			} else {
				value = element.val();
				if (trim && value != null && typeof value.trim === 'function') {
					value = value.trim();
				}
				if (empty || value !== void 0 && (value == null || value.length !== 0)) {
					return value;
				} else {
					return void 0;
				}
			}
		},
		/**
		 Calls the set-hook of the given element.
		 If no hook is specified it gets treated as input-field.
		 @param element The JQuery-Object of the element to fill.
		 @param value The value to set.
		 */
		fillField: function (element, value) {
			var hook = getHook(element, 'set'),
				trim = element.data('trim');
			trim = trim !== 'false' && +trim !== 0;
			if (hook != null) {
				return hook.call(Settings, element, value, trim);
			}
			if (value instanceof Array) {
				value = value.join(element.data('split') || (trim ? ', ' : ','));
			}
			if (trim && value && typeof value.trim === 'function') {
				value = value.trim();
				if (typeof value.toString === 'function') {
					value = value.toString();
				}
			} else if (value != null) {
				if (typeof value.toString === 'function') {
					value = value.toString();
				}
				if (trim) {
					value = value.trim();
				}
			} else {
				value = '';
			}
			if (value !== void 0) {
				element.val(value);
			}
		},
		/**
		 Calls the init-hook and {@link helper.fillField} on each field within wrapper-object.
		 @param wrapper The wrapper-element to set settings within.
		 */
		initFields: function (wrapper) {
			$('[data-key]', wrapper).each(function (ignored, field) {
				field = $(field);
				var hook = getHook(field, 'init'),
					keyParts = field.data('key').split('.'),
					value = Settings.get();
				if (hook != null) {
					hook.call(Settings, field);
				}
				for (var i = 0; i < keyParts.length; i++) {
					var part = keyParts[i];
					if (part && value != null) {
						value = value[part];
					}
				}
				helper.fillField(field, value);
			});
		},
		/**
		 Increases the amount of jobs before settings are ready by given amount.
		 @param amount The amount of jobs to register.
		 */
		registerReadyJobs: function (amount) {
			return waitingJobs += amount;
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
					for (var i = 0; i < onReady.length; i++) {
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
		/**
		 Persists the given settings with given hash.
		 @param hash The hash to use as settings-id.
		 @param settings The settings-object to persist.
		 @param notify Whether to send notification when settings got saved.
		 @param callback The callback to call when done.
		 */
		persistSettings: function (hash, settings, notify, callback) {
			if (settings != null && settings._ != null && typeof settings._ !== 'string') {
				settings = helper.deepClone(settings);
				settings._ = JSON.stringify(settings._);
			}
			socket.emit('admin.settings.set', {
				hash: hash,
				values: settings
			}, function (err) {
				if (notify) {
					if (err) {
						app.alert({
							title: 'Settings Not Saved',
							type: 'danger',
							message: "NodeBB failed to save the settings.",
							timeout: 5000
						});
						console.log('[settings] Unable to set settings for hash: ', hash);
					} else {
						app.alert({
							title: 'Settings Saved',
							type: 'success',
							message: "Settings have been successfully saved",
							timeout: 2500
						});
					}
				}
				if (typeof callback === 'function') {
					callback(err);
				}
			});
		},
		/**
		 Sets the settings to use to given settings.
		 @param settings The settings to use.
		 */
		use: function (settings) {
			try {
				settings._ = JSON.parse(settings._);
			} catch (_error) {}
			Settings.cfg = settings;
		}
	};


	Settings = {
		helper: helper,
		plugins: {},
		cfg: {},

		/**
		 Returns the saved settings.
		 @returns Object The settings.
		 */
		get: function () {
			if (Settings.cfg != null && Settings.cfg._ !== void 0) {
				return Settings.cfg._;
			}
			return Settings.cfg;
		},
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
			for (var i = 0; i < types.length; i++) {
				var type = types[i].toLowerCase();
				if (Settings.plugins[type] == null) {
					Settings.plugins[type] = service;
				}
			}
		},
		/**
		 Sets the settings to given ones, resets the fields within given wrapper and saves the settings server-side.
		 @param hash The hash to use as settings-id.
		 @param settings The settings to set.
		 @param wrapper The wrapper-element to find settings within.
		 @param callback The callback to call when done.
		 @param notify Whether to send notification when settings got saved.
		 */
		set: function (hash, settings, wrapper, callback, notify) {
			if (notify == null) {
				notify = true;
			}
			helper.whenReady(function () {
				helper.use(settings);
				helper.initFields(wrapper || 'form');
				helper.persistSettings(hash, settings, notify, callback);
			});
		},
		/**
		 Fetches the settings from server and calls {@link Settings.helper.initFields} once the settings are ready.
		 @param hash The hash to use as settings-id.
		 @param wrapper The wrapper-element to set settings within.
		 @param callback The callback to call when done.
		 */
		sync: function (hash, wrapper, callback) {
			socket.emit('admin.settings.get', {
				hash: hash
			}, function (err, values) {
				if (err) {
					console.log('[settings] Unable to load settings for hash: ', hash);
					if (typeof callback === 'function') {
						callback(err);
					}
				} else {
					helper.whenReady(function () {
						helper.use(values);
						helper.initFields(wrapper || 'form');
						if (typeof callback === 'function') {
							callback();
						}
					});
				}
			});
		},
		/**
		 Reads the settings from fields and saves them server-side.
		 @param hash The hash to use as settings-id.
		 @param wrapper The wrapper-element to find settings within.
		 @param callback The callback to call when done.
		 @param notify Whether to send notification when settings got saved.
		 */
		persist: function (hash, wrapper, callback, notify) {
			var notSaved = [],
				fields = $('[data-key]', wrapper || 'form').toArray();
			if (notify == null) {
				notify = true;
			}
			for (var i = 0; i < fields.length; i++) {
				var field = $(fields[i]),
					value = helper.readValue(field),
					parentCfg = Settings.get(),
					keyParts = field.data('key').split('.'),
					lastKey = keyParts[keyParts.length - 1];
				if (keyParts.length > 1) {
					for (var j = 0; j < keyParts.length - 1; j++) {
						var part = keyParts[j];
						if (part && parentCfg != null) {
							parentCfg = parentCfg[part];
						}
					}
				}
				if (parentCfg != null) {
					if (value != null) {
						parentCfg[lastKey] = value;
					} else {
						delete parentCfg[lastKey];
					}
				} else {
					notSaved.push(field.data('key'));
				}
			}
			if (notSaved.length) {
				app.alert({
					title: 'Attributes Not Saved',
					message: "'" + (notSaved.join(', ')) + "' could not be saved. Please contact the plugin-author!",
					type: 'danger',
					timeout: 5000
				});
			}
			helper.persistSettings(hash, Settings.cfg, notify, callback);
		},
		load: function (hash, formEl, callback) {
			callback = callback || function() {};
			socket.emit('admin.settings.get', {
				hash: hash
			}, function (err, values) {
				if (err) {
					console.log('[settings] Unable to load settings for hash: ', hash);
					return callback(err);
				}

				$(formEl).deserialize(values);

				callback(null, values);
			});
		},
		save: function (hash, formEl, callback) {
			formEl = $(formEl);
			if (formEl.length) {
				var values = formEl.serializeObject();
				// "Fix" checkbox values, so that unchecked options are not omitted
				formEl.find('input[type="checkbox"]').each(function (idx, inputEl) {
					inputEl = $(inputEl);
					if (!inputEl.is(':checked')) {
						values[inputEl.attr('id')] = 'off';
					}
				});
				socket.emit('admin.settings.set', {
					hash: hash,
					values: values
				}, function (err) {
					if (typeof callback === 'function') {
						callback();
					} else {
						app.alert({
							title: 'Settings Saved',
							type: 'success',
							timeout: 2500
						});
					}
				});
			} else {
				console.log('[settings] Form not found.');
			}
		}
	};


	helper.registerReadyJobs(1);
	require(DEFAULT_PLUGINS, function () {
		for (var i = 0; i < arguments.length; i++) {
			Settings.registerPlugin(arguments[i]);
		}
		helper.beforeReadyJobsDecreased();
	});

	return Settings;

});
