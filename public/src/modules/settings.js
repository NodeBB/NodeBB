var __slice = [].slice;

define(function() {
  var Settings, defaultPlugins, getHook;
  defaultPlugins = ['settings/checkbox', 'settings/textarea', 'settings/select', 'settings/array', 'settings/key'];

  /*
    * Hooks for plugins:
    *
    * [void]    use() - when the Settings initializes the plugin
    *
    * [void]    init(element) - on page-load and every time after create
    *
    * [element] create(type, tagName, data) - [element accepted by JQuery] when a new HTML-instance needs to get created
    *             (e.g. by array-expansion). Not called at page-load
    *           type: a string that identifies the plugin itself within this Settings-instance if set as data-type
    *           tagName: the tag-name that gets requested
    *           data: additional data with plugin-dependent meaning
    *
    * [void]    destruct(element) - after a HTML-instance got removed from DOM
    *
    * [void]    set(element, value, trim) - when the value of the element should get set to given value
    *           trim: whether the value is considered as trimmed
    *
    * [object]  get(element, trim, empty) - [whatever should be saved] when the value of the given instance is needed
    *             (e.g. when save got clicked)
    *           trim: whether the result should get trimmed
    *           empty: whether considered as empty values should get saved too
    *
    *
    * All given elements are JQuery-objects.
    * All callbacks get triggered within Settings-scope.
    *
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
  getHook = function(type, name) {
    var plugin;
    if (typeof type !== 'string') {
      type = $(type);
      type = type.data('type') || type.attr('type') || type.prop('tagName');
    }
    plugin = Settings.plugins[type.toLowerCase()];
    if (plugin == null) {
      return null;
    }
    return plugin[name];
  };
  return Settings = {
    helper: {
      deepClone: function(obj) {
        if (typeof obj === 'object') {
          return JSON.parse(JSON.stringify(obj));
        } else {
          return obj;
        }
      },
      createElement: function(tagName, data, text) {
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
      initElement: function(element) {
        var hook;
        hook = getHook(element, 'init');
        if (hook != null) {
          return hook.call(Settings, $(element));
        }
        return null;
      },
      destructElement: function(element) {
        var hook;
        hook = getHook(element, 'destruct');
        if (hook != null) {
          return hook.call(Settings, $(element));
        }
      },
      createElementOfType: function(type, tagName, data) {
        var el, hook;
        hook = getHook(type, 'create');
        el = hook != null ? $(hook.call(Settings, type, tagName, data)) : (data == null ? data = {} : void 0, type != null ? data.type = type : void 0, el = $(Settings.helper.createElement(tagName || 'input', data)));
        el.data('type', type);
        Settings.helper.initElement(el);
        return el;
      },
      cleanArray: function(arr, trim, empty) {
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
      isTrue: function(value) {
        return value === 'true' || +value === 1;
      },
      isFalse: function(value) {
        return value === 'false' || +value === 0;
      },
      readValue: function(field) {
        var empty, hook, split, trim, val, _ref, _ref1;
        trim = !Settings.helper.isFalse(field.data('trim'));
        empty = !Settings.helper.isFalse(field.data('empty'));
        hook = getHook(field, 'get');
        if (hook != null) {
          return hook.call(Settings, field, trim, empty);
        }
        if ((split = field.data('split')) != null) {
          empty = Settings.helper.isTrue(field.data('empty'));
          return Settings.helper.cleanArray(((_ref = field.val()) != null ? _ref.split(split || ',') : void 0) || [], trim, empty);
        } else {
          val = trim ? (_ref1 = field.val()) != null ? _ref1.trim() : void 0 : field.val();
          if (empty || (val != null) && val.length !== 0) {
            return val;
          } else {
            return null;
          }
        }
      },
      fillField: function(field, value) {
        var hook, trim;
        trim = field.data('trim');
        trim = trim !== 'false' && +trim !== 0;
        hook = getHook(field, 'set');
        if (hook != null) {
          return hook.call(Settings, field, value, trim);
        }
        if ((value != null) && typeof field.val === 'function') {
          field.val(value);
        }
        if (value instanceof Array) {
          value = value.join(field.data('split') || (trim ? ', ' : ','));
        }
        if (trim && typeof (value != null ? value.trim : void 0) === 'function') {
          return value.trim().toString();
        } else {
          if (value != null) {
            if (trim) {
              return value.toString().trim();
            } else {
              return value.toString();
            }
          } else {
            return '';
          }
        }
      },
      initFields: function() {
        $('[data-key]', Settings.wrapper).each(function(ignored, field) {
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
          return Settings.helper.fillField(field, value);
        });
        return $('#save').click(function(e) {
          e.preventDefault();
          return Settings.persist();
        });
      },
      onReady: [],
      waitingJobs: 1,
      doReadyStep: function() {
        var cb, _i, _len, _ref;
        if (Settings.helper.waitingJobs > 0) {
          Settings.helper.waitingJobs--;
          if (Settings.helper.waitingJobs === 0) {
            _ref = Settings.helper.onReady;
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              cb = _ref[_i];
              cb();
            }
            return Settings.helper.onReady = [];
          }
        }
      },
      whenReady: function(cb) {
        if (Settings.helper.waitingJobs === 0) {
          return cb();
        } else {
          return Settings.helper.onReady.push(cb);
        }
      }
    },
    hash: '',
    wrapper: '',
    plugins: {},
    cfg: {},
    get: function() {
      var _ref;
      if (((_ref = Settings.cfg) != null ? _ref._settings : void 0) != null) {
        return Settings.cfg._settings;
      } else {
        return Settings.cfg;
      }
    },
    registerPlugin: function(service, types) {
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
    init: function(hash, wrapper, callback) {
      if (wrapper == null) {
        wrapper = "form";
      }
      Settings.hash = hash;
      Settings.wrapper = wrapper;
      require(defaultPlugins, function() {
        var args, plugin, _i, _len;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        for (_i = 0, _len = args.length; _i < _len; _i++) {
          plugin = args[_i];
          Settings.registerPlugin(plugin);
        }
        return Settings.helper.doReadyStep();
      });
      return Settings.sync(callback);
    },
    sync: function(callback) {
      return socket.emit('admin.settings.get', {
        hash: Settings.hash
      }, function(err, values) {
        if (err) {
          console.log('[settings] Unable to load settings for hash: ', Settings.hash);
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
          return Settings.helper.whenReady(function() {
            Settings.helper.initFields();
            if (typeof callback === 'function') {
              return callback();
            }
          });
        }
      });
    },
    persist: function(callback) {
      var field, k, keyParts, lastKey, notSaved, parentCfg, settings, value, _i, _j, _len, _len1, _ref, _ref1;
      notSaved = [];
      _ref = $('[data-key]', Settings.wrapper).toArray();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        field = _ref[_i];
        field = $(field);
        value = Settings.helper.readValue(field);
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
          timeout: 5000,
          title: 'Attributes Not Saved',
          message: "'" + (notSaved.join(', ')) + "' could not be saved. Please contact the plugin-author!",
          type: 'danger'
        });
      }
      settings = Settings.cfg;
      if ((settings != null ? settings._settings : void 0) != null) {
        settings._settings = JSON.stringify(settings._settings);
      }
      return socket.emit('admin.settings.set', {
        hash: Settings.hash,
        values: settings
      }, function() {
        app.alert({
          title: 'Settings Saved',
          type: 'success',
          timeout: 2500
        });
        if (typeof callback === 'function') {
          return callback();
        }
      });
    },
    load: function(hash, formEl, callback) {
      return socket.emit('admin.settings.get', {
        hash: hash
      }, function(err, values) {
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
    save: function(hash, formEl, callback) {
      var values;
      formEl = $(formEl);
      if (!formEl.length) {
        return console.log('[settings] Form not found.');
      } else {
        values = formEl.serializeObject();
        formEl.find('input[type="checkbox"]').each(function(i, inputEl) {
          inputEl = $(inputEl);
          if (!inputEl.is(':checked')) {
            return values[inputEl.attr('id')] = 'off';
          }
        });
        return socket.emit('admin.settings.set', {
          hash: hash,
          values: values
        }, function() {
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
});
