var __slice = [].slice;

define(function () {
	var Settings, defaultPlugins, getHook, onReady, waitingJobs, _h;
	defaultPlugins = ['settings/checkbox', 'settings/textarea', 'settings/select', 'settings/array', 'settings/key'];

	/*
    * Attributes of HTML-tags that get used by default plugins:
    *   + data-key:   the key to save/load the value within configuration-object
    *   + data-type:  highest priority type-definition to determine what kind of element it is or which plugin to hook
    *   + type:       normal priority type-definition
    *   + data-empty: if 'false' or '0' then values that are assumed as empty turn into null. data-empty of arrays affect
    *                 their child-elements
    *   + data-trim:  if not 'false' or '0' then values will get trimmed as defined by the elements type
    *   + data-split: if set and the element doesn't belong to any plugin, it's value will get split and joined by its
    *                 value into the input-field
    *   array-elements:
    *     + data-split:      separator (HTML allowed) between the elements, defaults to ', '
    *     + data-new:        value to insert into new created elements
    *     + data-attributes: an object to set the attributes of the child HTML-elements. tagName as special key will set
    *                        the tag-name of the child HTML-elements
    *   key-fields:
    *     + data-trim:  if 'false' or '0' then the value will get saved as string else as object providing following
    *                   properties: ctrl, alt, shift, meta, code, char
    *     + data-split: separator between different modifiers and the key-code of the value that gets saved
    *                   (only takes effect if trimming)
    *     + data-short: if not 'false' or '0' then modifier-keys get saved as first uppercase character
    *                   (only takes effect if trimming)
    *   select:
    *     + data-options: an array of {"text":"Displayed Text","value":"some_value"}-like objects
    *
    * The name of the HTML-tag is lowest priority type-definition
    *
    * Examples-HTML:
       No!
       <input type="checkbox" data-key="cfg1"></input><br>
       Yes!
       <input type="checkbox" data-key="cfg2"></input><br>
       An array of checkboxes that are selected by default:
       <div data-key="cfg3" data-attributes='{"data-type":"checkbox"}' data-new='true'></div><br>
       A simple input-field of any common type:
       <input type="password" data-key="cfg4"></input><br>
       A simple textarea:
       <textarea data-key="cfg5"></textarea><br>
       Array of textareas:
       <div data-key="cfg6" data-attributes='{"data-type":"textarea"}' data-new='Hello Kitty, ahem... World!'></div><br>
       2D-Array of numbers that persist even when empty (but not empty rows):
       <div data-key="cfg7" data-split="<br>" data-attributes='{"data-type":"array","data-attributes":{"type":"number"}}' data-new='[42,21]'></div><br>
       Same with persisting empty rows, but not empty numbers, if no row is given null will get saved:
       <div data-key="cfg8" data-split="<br>" data-empty="false" data-attributes='{"data-type":"array","data-empty":true,"data-attributes":{"type":"number","data-empty":false}}' data-new='[42,21]'></div><br>
       Array of Key-shortcuts (new: Ctrl+Shift+7):
       <div data-key="cfg9" data-attributes='{"data-type":"key"}' data-new='Ctrl+Shift+#55'></div><br>
       Array of numbers (new: 42, step: 21):
       <div data-key="cfg10" data-attributes='{"data-type":"number","step":21}' data-new='42'></div><br>
       Select with dynamic options:
       <select data-key="cfg11" data-options='[{"value":"2","text":"2"},{"value":"3","text":"3"}]'></select><br>
       Select that loads faster:
       <select data-key="cfg12"><br>
         <option value="2">2</option>
         <option value="3">3</option>
       </select>
    *
    * Matching configuration:
       {
         cfg1: false,
         cfg2: true,
         cfg3: [false, false, true],
         cfg4: 'hello world',
         cfg5: 'some\nlong\ntext',
         cfg6: ['some\nlong\ntexts', 'and another one'],
         cfg7: [[]],
         cfg8: [[]],
         cfg9: [],
         cfg10: [],
         cfg11: 3,
         cfg12: 2
       }
   */

	/**
    Returns the hook of given name that matches the given type or element.
    @param type The type of the element to get the matching hook for, or the element itself.
    @param name The name of the hook.
   */
	getHook = function (type, name) {
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
	};
	onReady = [];
	waitingJobs = 0;
	_h = {

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
			var el, k, v;
			el = document.createElement(tagName);
			for (k in data) {
				v = data[k];
				el.setAttribute(k, v);
			}
			if (text) {
				el.appendChild(document.createTextNode(text));
			}
			return el;
		},

		/**
      Calls the init-hook of the given element.
      @param The element to initialize.
     */
		initElement: function (element) {
			var hook;
			hook = getHook(element, 'init');
			if (hook != null) {
				return hook.call(Settings, $(element));
			}
			return null;
		},

		/**
      Calls the destruct-hook of the given element.
      @param The element to destruct.
     */
		destructElement: function (element) {
			var hook;
			hook = getHook(element, 'destruct');
			if (hook != null) {
				return hook.call(Settings, $(element));
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
			var el, hook;
			hook = getHook(type, 'create');
			el = hook != null ? $(hook.call(Settings, type, tagName, data)) : (data == null ? data = {} : void 0, type != null ? data.type = type : void 0, el = $(_h.createElement(tagName || 'input', data)));
			el.data('type', type);
			_h.initElement(el);
			return el;
		},

		/**
      Creates a new Array that contains values of given Array depending on trim and empty.
      @param trim Whether to trim each value if it has a trim-function.
      @param empty Whether empty values should get added.
      @returns Array The filtered and/or modified Array.
     */
		cleanArray: function (arr, trim, empty) {
			var cleaned, val, _i, _len;
			if (!trim && empty) {
				return arr;
			}
			cleaned = [];
			for (_i = 0, _len = arr.length; _i < _len; _i++) {
				val = arr[_i];
				if (trim) {
					val = val === true ? 1 : val === false ? 0 : val.trim != null ? val.trim() : val;
				}
				if (empty || (val != null ? val.length : void 0)) {
					cleaned.push(val);
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
			var empty, hook, split, trim, val, _ref, _ref1;
			trim = !_h.isFalse(element.data('trim'));
			empty = !_h.isFalse(element.data('empty'));
			hook = getHook(element, 'get');
			if (hook != null) {
				return hook.call(Settings, element, trim, empty);
			}
			if ((split = element.data('split')) != null) {
				empty = _h.isTrue(element.data('empty'));
				return _h.cleanArray(((_ref = element.val()) != null ? _ref.split(split || ',') : void 0) || [], trim, empty);
			} else {
				val = trim ? (_ref1 = element.val()) != null ? _ref1.trim() : void 0 : element.val();
				if (empty || val !== void 0 && (val != null ? val.length : void 0) !== 0) {
					return val;
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
			var hook, trim;
			trim = element.data('trim');
			trim = trim !== 'false' && +trim !== 0;
			hook = getHook(element, 'set');
			if (hook != null) {
				return hook.call(Settings, element, value, trim);
			}
			if (value instanceof Array) {
				value = value.join(element.data('split') || (trim ? ', ' : ','));
			}
			value = trim && typeof (value != null ? value.trim : void 0) === 'function' ? value.trim().toString() : value != null ? trim ? value.toString().trim() : value.toString() : '';
			if (value != null) {
				return element.val(value);
			}
		},

		/**
      Calls the init-hook and {@link _h.fillField} on each field within wrapper-object.
      @param wrapper The wrapper-element to set settings within.
     */
		initFields: function (wrapper) {
			return $('[data-key]', wrapper).each(function (ignored, field) {
				var hook, k, keyParts, value, _i, _len;
				field = $(field);
				hook = getHook(field, 'init');
				if (hook != null) {
					hook.call(Settings, field);
				}
				keyParts = field.data('key').split('.');
				value = Settings.get();
				for (_i = 0, _len = keyParts.length; _i < _len; _i++) {
					k = keyParts[_i];
					if (k && (value != null)) {
						value = value[k];
					}
				}
				return _h.fillField(field, value);
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
      If the amount is less or equal 0 all callbacks registered by {@link _h.whenReady} get called.
      @param amount The amount of jobs that finished.
     */
		beforeReadyJobsDecreased: function (amount) {
			var cb, _i, _len;
			if (amount == null) {
				amount = 1;
			}
			if (waitingJobs > 0) {
				waitingJobs -= amount;
				if (waitingJobs <= 0) {
					for (_i = 0, _len = onReady.length; _i < _len; _i++) {
						cb = onReady[_i];
						cb();
					}
					return onReady = [];
				}
			}
		},

		/**
      Calls the given callback when the settings are ready.
      @param callback The callback.
     */
		whenReady: function (callback) {
			if (waitingJobs <= 0) {
				return callback();
			} else {
				return onReady.push(callback);
			}
		}
	};
	Settings = {
		helper: _h,
		plugins: {},
		cfg: {},

		/**
      Returns the saved settings.
      @returns Object The settings.
     */
		get: function () {
			var _ref;
			if (((_ref = Settings.cfg) != null ? _ref._settings : void 0) != null) {
				return Settings.cfg._settings;
			} else {
				return Settings.cfg;
			}
		},

		/**
      Registers a new plugin and calls its use-hook.
      A plugin is an object containing a types-property to define its default bindings.
      A plugin may also provide the following properties of type function with [return-value] (parameters):
        use [void] - gets called when the Settings initializes the plugin.
        init [void] (element) - gets called on page-load and every time after the create-hook.
          ; element: The element to initialize.
        create [JQuery-Object] (type, tagName, data) - gets called when a new HTML-instance needs to get created.
          ; type: A string that identifies the plugin itself within this Settings-instance if set as data-type.
          ; tagName: The tag-name that gets requested.
          ; data: Additional data, plugin-dependent meaning.
        destruct [void] (element) - gets called after a HTML-instance got removed from DOM
          ; element: The element that got removed.
        set [void] (element, value, trim) - gets called when the value of the element should be set to the given value.
          ; element: The element to set its value.
          ; value: The value to set.
          ; trim: Whether the value is considered as trimmed.
        get [value] (element, trim, empty) - gets called when the value of the given instance is needed.
          ; element: The element to get its value.
          ; trim: Whether the result should be trimmed.
          ; empty: Whether considered as empty values should get saved too.
    
      All passed elements are JQuery-Objects.
      @param service The plugin to register.
      @param types The types to bind the plugin to.
     */
		registerPlugin: function (service, types) {
			var type, typeL, _i, _len, _ref, _results;
			if (types == null) {
				types = service.types;
			}
			service.types = types;
			if (service.use != null) {
				if ((_ref = service.use) != null) {
					_ref.call(Settings);
				}
			}
			_results = [];
			for (_i = 0, _len = types.length; _i < _len; _i++) {
				type = types[_i];
				if (Settings.plugins[typeL = type.toLowerCase()] == null) {
					_results.push(Settings.plugins[typeL] = service);
				}
			}
			return _results;
		},

		/**
      Fetches the settings from server and calls {@link Settings.helper.initField} once the settings are ready.
      @param hash The hash to use as settings-id.
      @param wrapper The wrapper-element to set settings within.
      @param callback The callback to call when done.
     */
		sync: function (hash, wrapper, callback) {
			if (wrapper == null) {
				wrapper = "form";
			}
			return socket.emit('admin.settings.get', {
				hash: hash
			}, function (err, values) {
				if (err) {
					console.log('[settings] Unable to load settings for hash: ', hash);
					if (typeof callback === 'function') {
						return callback(err);
					}
				} else {
					Settings.cfg = values;
					try {
						if (Settings.cfg._settings) {
							Settings.cfg._settings = JSON.parse(Settings.cfg._settings);
						}
					} catch (_error) {}
					return _h.whenReady(function () {
						_h.initFields(wrapper);
						if (typeof callback === 'function') {
							return callback();
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
			var field, k, keyParts, lastKey, notSaved, parentCfg, settings, value, _i, _j, _len, _len1, _ref, _ref1;
			if (wrapper == null) {
				wrapper = "form";
			}
			if (notify == null) {
				notify = true;
			}
			notSaved = [];
			_ref = $('[data-key]', wrapper).toArray();
			for (_i = 0, _len = _ref.length; _i < _len; _i++) {
				field = _ref[_i];
				field = $(field);
				value = _h.readValue(field);
				keyParts = field.data('key').split('.');
				parentCfg = Settings.get();
				if (keyParts.length > 1) {
					_ref1 = keyParts.slice(0, +(keyParts.length - 2) + 1 || 9e9);
					for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
						k = _ref1[_j];
						if (k && (parentCfg != null)) {
							parentCfg = parentCfg[k];
						}
					}
				}
				if (parentCfg != null) {
					lastKey = keyParts[keyParts.length - 1];
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
			settings = Settings.cfg;
			if ((settings != null ? settings._settings : void 0) != null) {
				settings._settings = JSON.stringify(settings._settings);
			}
			return socket.emit('admin.settings.set', {
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
							timeout: 2500
						});
					}
				}
				if (typeof callback === 'function') {
					return callback(err);
				}
			});
		},
		load: function (hash, formEl, callback) {
			return socket.emit('admin.settings.get', {
				hash: hash
			}, function (err, values) {
				if (err) {
					return console.log('[settings] Unable to load settings for hash: ', hash);
				} else {
					$(formEl).deserialize(values);
					if (typeof callback === 'function') {
						return callback();
					}
				}
			});
		},
		save: function (hash, formEl, callback) {
			var values;
			formEl = $(formEl);
			if (!formEl.length) {
				return console.log('[settings] Form not found.');
			} else {
				values = formEl.serializeObject();
				formEl.find('input[type="checkbox"]').each(function (i, inputEl) {
					inputEl = $(inputEl);
					if (!inputEl.is(':checked')) {
						return values[inputEl.attr('id')] = 'off';
					}
				});
				return socket.emit('admin.settings.set', {
					hash: hash,
					values: values
				}, function () {
					app.alert({
						title: 'Settings Saved',
						type: 'success',
						timeout: 2500
					});
					if (typeof callback === 'function') {
						return callback();
					}
				});
			}
		}
	};
	_h.registerReadyJobs(1);
	require(defaultPlugins, function () {
		var args, plugin, _i, _len;
		args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
		for (_i = 0, _len = args.length; _i < _len; _i++) {
			plugin = args[_i];
			Settings.registerPlugin(plugin);
		}
		return _h.beforeReadyJobsDecreased();
	});
	return Settings;
});
