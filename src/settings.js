var Settings, meta,
	__slice = [].slice;

meta = require('./meta');

Settings = (function () {
	var expandObjBy, mergeSettings, trim;

	Settings.prototype.hash = '';

	Settings.prototype.defCfg = {};

	Settings.prototype.cfg = {};

	Settings.prototype.version = '0.0.0';

	expandObjBy = function (obj1, obj2) {
		var key, val1, val2;
		for (key in obj2) {
			val2 = obj2[key];
			val1 = obj1[key];
			if (!obj1.hasOwnProperty(key) || typeof val2 !== typeof val1) {
				obj1[key] = val2;
			} else if (typeof val2 === 'object') {
				expandObjBy(val1, val2);
			}
		}
		return obj1;
	};

	trim = function (obj1, obj2) {
		var key, val1;
		for (key in obj1) {
			val1 = obj1[key];
			if (!obj2.hasOwnProperty(key)) {
				delete obj1[key];
			} else if (typeof val1 === 'object') {
				trim(val1, obj2[key]);
			}
		}
		return obj1;
	};

	mergeSettings = function (cfg, defCfg) {
		if (typeof cfg._settings !== typeof defCfg || typeof defCfg !== 'object') {
			return cfg._settings = defCfg;
		} else {
			expandObjBy(cfg._settings, defCfg);
			return trim(cfg._settings, defCfg);
		}
	};


	/**
    A class to manage Objects saved in {@link #meta#settings} within property "_settings".
    Constructor, synchronizes the settings and repairs them if version differs.
    @param hash The hash to use for {@link meta.settings}.
    @param version The version of the settings, used to determine whether the saved settings may be corrupt.
    @param defCfg The default settings.
    @param callback Gets called once the Settings-object is ready.
    @param forceUpdate Whether to trigger structure-update even if the version doesn't differ from saved one.
           Should be true while plugin-development to ensure structure-changes within settings persist.
    @param reset Whether to reset the settings.
   */

	function Settings(hash, version, defCfg, callback, forceUpdate, reset) {
		this.hash = hash;
		this.version = version || this.version;
		this.defCfg = defCfg;
		if (reset) {
			this.reset(callback);
		} else {
			this.sync(function () {
				return this.checkStructure(callback, forceUpdate);
			});
		}
	}


	/**
    Synchronizes the local object with the saved object (reverts changes).
    @param callback Gets called when done.
   */

	Settings.prototype.sync = function (callback) {
		var _this;
		_this = this;
		return meta.settings.get(this.hash, function (err, settings) {
			try {
				if (settings._settings) {
					settings._settings = JSON.parse(settings._settings);
				}
			} catch (_error) {}
			_this.cfg = settings;
			if (typeof callback === 'function') {
				return callback.apply(_this, err);
			}
		});
	};


	/**
    Persists the local object.
    @param callback Gets called when done.
   */

	Settings.prototype.persist = function (callback) {
		var conf, _this;
		_this = this;
		conf = this.cfg._settings;
		if (typeof conf === 'object') {
			conf = JSON.stringify(conf);
		}
		meta.settings.set(this.hash, {
			_settings: conf,
			version: this.cfg.version
		}, function () {
			var args;
			args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
			if (typeof callback === 'function') {
				return callback.apply(_this, args);
			}
		});
		return this;
	};


	/**
    Persists the settings if no settings are saved.
    @param callback Gets called when done.
   */

	Settings.prototype.persistOnEmpty = function (callback) {
		var _this;
		_this = this;
		meta.settings.get(this.hash, function (err, settings) {
			if (!settings._settings) {
				return _this.persist(callback);
			} else if (typeof callback === 'function') {
				return callback.call(_this);
			}
		});
		return this;
	};


	/**
    Returns the setting of given key or default value if not set.
    @param key The key of the setting to return.
    @param def The default value, if not set global default value gets used.
    @returns Object The setting to be used.
   */

	Settings.prototype.get = function (key, def) {
		var k, obj, parts, _i, _j, _len, _len1;
		if (key == null) {
			key = '';
		}
		obj = this.cfg._settings;
		parts = key.split('.');
		for (_i = 0, _len = parts.length; _i < _len; _i++) {
			k = parts[_i];
			if (k && (obj != null)) {
				obj = obj[k];
			}
		}
		if (obj === void 0) {
			if (def === void 0) {
				def = this.defCfg;
				for (_j = 0, _len1 = parts.length; _j < _len1; _j++) {
					k = parts[_j];
					if (k && (def != null)) {
						def = def[k];
					}
				}
			}
			return def;
		}
		return obj;
	};


	/**
    Sets the setting of given key to given value.
    @param key The key of the setting to set.
    @param val The value to set.
   */

	Settings.prototype.set = function (key, val) {
		var k, obj, parts, _i, _len, _ref;
		this.cfg.version = this.version;
		if ((val == null) || !key) {
			this.cfg._settings = val || key;
		} else {
			obj = this.cfg._settings;
			parts = key.split('.');
			_ref = parts.slice(0, +(parts.length - 2) + 1 || 9e9);
			for (_i = 0, _len = _ref.length; _i < _len; _i++) {
				k = _ref[_i];
				if (!(k)) {
					continue;
				}
				if (!obj.hasOwnProperty(k)) {
					obj[k] = {};
				}
				obj = obj[k];
			}
			obj[parts[parts.length - 1]] = val;
		}
		return this;
	};


	/**
    Resets the saved settings to default settings.
    @param callback Gets called when done.
   */

	Settings.prototype.reset = function (callback) {
		this.set(this.defCfg).persist(callback);
		return this;
	};


	/**
    If the version differs the settings get updated and persisted.
    @param callback Gets called when done.
    @param force Whether to update and persist the settings even if the versions ara equal.
   */

	Settings.prototype.checkStructure = function (callback, force) {
		if (!force && this.cfg.version === this.version) {
			if (typeof callback === 'function') {
				callback();
			}
		} else {
			mergeSettings(this.cfg, this.defCfg);
			this.cfg.version = this.version;
			this.persist(function () {
				if (typeof callback === 'function') {
					return callback();
				}
			});
		}
		return this;
	};

	return Settings;

})();

module.exports = Settings;
