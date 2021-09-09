'use strict';

var meta = require('./meta');
var pubsub = require('./pubsub');

function expandObjBy(obj1, obj2) {
	var key;
	var val1;
	var val2;
	var xorValIsArray;
	var changed = false;
	for (key in obj2) {
		if (obj2.hasOwnProperty(key)) {
			val2 = obj2[key];
			val1 = obj1[key];
			xorValIsArray = Array.isArray(val1) ^ Array.isArray(val2);
			if (xorValIsArray || !obj1.hasOwnProperty(key) || typeof val2 !== typeof val1) {
				obj1[key] = val2;
				changed = true;
			} else if (typeof val2 === 'object' && !Array.isArray(val2)) {
				if (expandObjBy(val1, val2)) {
					changed = true;
				}
			}
		}
	}
	return changed;
}

function trim(obj1, obj2) {
	var key;
	var val1;
	for (key in obj1) {
		if (obj1.hasOwnProperty(key)) {
			val1 = obj1[key];
			if (!obj2.hasOwnProperty(key)) {
				delete obj1[key];
			} else if (typeof val1 === 'object' && !Array.isArray(val1)) {
				trim(val1, obj2[key]);
			}
		}
	}
}

function mergeSettings(cfg, defCfg) {
	if (typeof defCfg !== 'object') {
		return;
	}
	if (typeof cfg._ !== 'object') {
		cfg._ = defCfg;
	} else {
		expandObjBy(cfg._, defCfg);
		trim(cfg._, defCfg);
	}
}

/**
 A class to manage Objects saved in {@link meta.settings} within property "_".
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
	var self = this;

	if (reset) {
		this.reset(callback);
	} else {
		this.sync(function () {
			this.checkStructure(callback, forceUpdate);
		});
	}
	pubsub.on('action:settings.set.' + hash, function (data) {
		try {
			self.cfg._ = JSON.parse(data._);
		} catch (err) {}
	});
}

Settings.prototype.hash = '';
Settings.prototype.defCfg = {};
Settings.prototype.cfg = {};
Settings.prototype.version = '0.0.0';

/**
 Synchronizes the local object with the saved object (reverts changes).
 @param callback Gets called when done.
 */
Settings.prototype.sync = function (callback) {
	var _this = this;
	meta.settings.get(this.hash, function (err, settings) {
		try {
			if (settings._) {
				settings._ = JSON.parse(settings._);
			}
		} catch (_error) {}
		_this.cfg = settings;
		if (typeof _this.cfg._ !== 'object') {
			_this.cfg._ = _this.defCfg;
			_this.persist(callback);
		} else if (expandObjBy(_this.cfg._, _this.defCfg)) {
			_this.persist(callback);
		} else if (typeof callback === 'function') {
			callback.apply(_this, err);
		}
	});
};

/**
 Persists the local object.
 @param callback Gets called when done.
 */
Settings.prototype.persist = function (callback) {
	var conf = this.cfg._;
	var _this = this;
	if (typeof conf === 'object') {
		conf = JSON.stringify(conf);
	}
	meta.settings.set(this.hash, this.createWrapper(this.cfg.v, conf), function () {
		if (typeof callback === 'function') {
			callback.apply(_this, arguments || []);
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
	var obj = this.cfg._;
	var parts = (key || '').split('.');
	var part;
	for (var i = 0; i < parts.length; i += 1) {
		part = parts[i];
		if (part && obj != null) {
			obj = obj[part];
		}
	}
	if (obj === undefined) {
		if (def === undefined) {
			def = this.defCfg;
			for (var j = 0; j < parts.length; j += 1) {
				part = parts[j];
				if (part && def != null) {
					def = def[part];
				}
			}
		}
		return def;
	}
	return obj;
};

/**
 Returns the settings-wrapper object.
 @returns Object The settings-wrapper.
 */
Settings.prototype.getWrapper = function () {
	return this.cfg;
};

/**
 Creates a new wrapper for the given settings with the given version.
 @returns Object The new settings-wrapper.
 */
Settings.prototype.createWrapper = function (version, settings) {
	return {
		v: version,
		_: settings,
	};
};

/**
 Creates a new wrapper for the default settings.
 @returns Object The new settings-wrapper.
 */
Settings.prototype.createDefaultWrapper = function () {
	return this.createWrapper(this.version, this.defCfg);
};

/**
 Sets the setting of given key to given value.
 @param key The key of the setting to set.
 @param val The value to set.
 */
Settings.prototype.set = function (key, val) {
	var part;
	var obj;
	var parts;
	this.cfg.v = this.version;
	if (val == null || !key) {
		this.cfg._ = val || key;
	} else {
		obj = this.cfg._;
		parts = key.split('.');
		for (var i = 0, _len = parts.length - 1; i < _len; i += 1) {
			part = parts[i];
			if (part) {
				if (!obj.hasOwnProperty(part)) {
					obj[part] = {};
				}
				obj = obj[part];
			}
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
	if (!force && this.cfg.v === this.version) {
		if (typeof callback === 'function') {
			callback();
		}
	} else {
		mergeSettings(this.cfg, this.defCfg);
		this.cfg.v = this.version;
		this.persist(callback);
	}
	return this;
};

module.exports = Settings;
