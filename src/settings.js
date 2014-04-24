var Settings, merge, mergeSettings, meta, trim,
  __slice = [].slice;

meta = require('./meta');

merge = function(obj1, obj2) {
  var key, val1, val2;
  for (key in obj2) {
    val2 = obj2[key];
    val1 = obj1[key];
    if (!obj1.hasOwnProperty(key)) {
      obj1[key] = val2;
    } else if (typeof val2 !== typeof val1) {
      obj1[key] = val2;
    } else if (typeof val2 === 'object') {
      merge(val1, val2);
    }
  }
  return obj1;
};

trim = function(obj1, obj2) {
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

mergeSettings = function(cfg, defCfg) {
  if (typeof cfg._settings !== typeof defCfg || typeof defCfg !== 'object') {
    return cfg._settings = defCfg;
  } else {
    merge(cfg._settings, defCfg);
    return trim(cfg._settings, defCfg);
  }
};

Settings = (function() {
  Settings.prototype.hash = '';

  Settings.prototype.defCfg = {};

  Settings.prototype.cfg = {};

  Settings.prototype.version = '0.0.0';

  function Settings(id, version, defCfg, callback, forceUpdate, reset) {
    this.hash = id;
    this.version = version || this.version;
    this.defCfg = defCfg;
    if (reset) {
      this.reset(callback);
    } else {
      this.sync(function() {
        return this.checkStructure(forceUpdate, callback);
      });
    }
  }

  Settings.prototype.sync = function(callback) {
    var _this;
    _this = this;
    return meta.settings.get(this.hash, function(err, settings) {
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

  Settings.prototype.persist = function(callback) {
    var conf, _this;
    _this = this;
    conf = this.cfg._settings;
    if (typeof conf === 'object') {
      conf = JSON.stringify(conf);
    }
    meta.settings.set(this.hash, {
      _settings: conf,
      version: this.cfg.version
    }, function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      if (typeof callback === 'function') {
        return callback.apply(_this, args);
      }
    });
    return this;
  };

  Settings.prototype.persistOnEmpty = function(callback) {
    var _this;
    _this = this;
    meta.settings.get(this.hash, function(err, settings) {
      if (!settings) {
        return _this.persist(callback);
      } else if (typeof callback === 'function') {
        return callback.call(_this);
      }
    });
    return this;
  };

  Settings.prototype.get = function(key, def) {
    var k, obj, parts, _i, _j, _len, _len1;
    if (key == null) {
      key = '';
    }
    if (def == null) {
      def = null;
    }
    obj = this.cfg._settings;
    parts = key.split('.');
    for (_i = 0, _len = parts.length; _i < _len; _i++) {
      k = parts[_i];
      if (k && (obj != null)) {
        obj = obj[k];
      }
    }
    if (obj == null) {
      if (!def) {
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

  Settings.prototype.set = function(key, val) {
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

  Settings.prototype.reset = function(callback) {
    this.set(this.defCfg).persist(function() {
      if (typeof callback === 'function') {
        return callback();
      }
    });
    return this;
  };

  Settings.prototype.checkStructure = function(force, callback) {
    if (!force && this.cfg.version === this.version) {
      if (typeof callback === 'function') {
        callback();
      }
    } else {
      mergeSettings(this.cfg, this.defCfg);
      this.cfg.version = this.version;
      this.persist(function() {
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
