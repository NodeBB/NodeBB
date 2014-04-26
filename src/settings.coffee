meta = require './meta'

class Settings

  hash: ''
  defCfg: {}
  cfg: {}
  version: '0.0.0'

  expandObjBy = (obj1, obj2) ->
    # repairs recursive all values of obj1 by resetting to property of obj2 if not valid (not same type or not set)
    for key, val2 of obj2
      val1 = obj1[key]
      if !obj1.hasOwnProperty(key) || typeof val2 != typeof val1
        obj1[key] = val2
      else if typeof val2 == 'object'
        expandObjBy val1, val2
    obj1
  trim = (obj1, obj2) ->
    # removes recursive all properties of obj1 that are not set within obj2
    for key, val1 of obj1
      if !obj2.hasOwnProperty key
        delete obj1[key]
      else if typeof val1 == 'object'
        trim val1, obj2[key]
    obj1
  mergeSettings = (cfg, defCfg) ->
    # repair given config
    if typeof cfg._settings != typeof defCfg || typeof defCfg != 'object'
      cfg._settings = defCfg
    else
      expandObjBy cfg._settings, defCfg
      trim cfg._settings, defCfg

  ###*
    A class to manage Objects saved in {@link #meta#settings} within property "_settings".
    Constructor, synchronizes the settings and repairs them if version differs.
    @param hash The hash to use for {@link meta.settings}.
    @param version The version of the settings, used to determine whether the saved settings may be corrupt.
    @param defCfg The default settings.
    @param callback Gets called once the Settings-object is ready.
    @param forceUpdate Whether to trigger structure-update even if the version doesn't differ from saved one.
           Should be true while plugin-development to ensure structure-changes within settings persist.
    @param reset Whether to reset the settings.
  ###
  constructor: (hash, version, defCfg, callback, forceUpdate, reset) ->
    this.hash = hash
    this.version = version || this.version
    this.defCfg = defCfg
    if reset
      this.reset callback
    else
      this.sync ->
        this.checkStructure callback, forceUpdate
  ###*
    Synchronizes the local object with the saved object (reverts changes).
    @param callback Gets called when done.
  ###
  sync: (callback) ->
    _this = this
    meta.settings.get this.hash, (err, settings) ->
      try settings._settings = JSON.parse settings._settings if settings._settings
      _this.cfg = settings
      callback.apply _this, err if typeof callback == 'function'
  ###*
    Persists the local object.
    @param callback Gets called when done.
  ###
  persist: (callback) ->
    _this = this
    conf = this.cfg._settings
    conf = JSON.stringify conf if typeof conf == 'object'
    meta.settings.set this.hash,
      _settings: conf
      version: this.cfg.version
    , (args...) ->
      callback.apply _this, args if typeof callback == 'function'
    this
  ###*
    Persists the settings if no settings are saved.
    @param callback Gets called when done.
  ###
  persistOnEmpty: (callback) ->
    _this = this
    meta.settings.get this.hash, (err, settings) ->
      if !settings._settings
        _this.persist callback
      else if typeof callback == 'function'
        callback.call _this
    this
  ###*
    Returns the setting of given key or default value if not set.
    @param key The key of the setting to return.
    @param def The default value, if not set global default value gets used.
    @returns Object The setting to be used.
  ###
  get: (key = '', def) ->
    obj = this.cfg._settings
    parts = key.split '.'
    obj = obj[k] for k in parts when k && obj?
    if obj == undefined # null is valid value
      if def == undefined # null is valid default-value
        def = this.defCfg
        def = def[k] for k in parts when k && def?
      return def
    obj
  ###*
    Sets the setting of given key to given value.
    @param key The key of the setting to set.
    @param val The value to set.
  ###
  set: (key, val) ->
    this.cfg.version = this.version
    if !val? || !key
      this.cfg._settings = val || key
    else
      obj = this.cfg._settings
      parts = key.split '.'
      for k in parts[0..parts.length - 2] when k
        obj[k] = {} if !obj.hasOwnProperty k
        obj = obj[k]
      obj[parts[parts.length - 1]] = val
    this
  ###*
    Resets the saved settings to default settings.
    @param callback Gets called when done.
  ###
  reset: (callback) ->
    this.set(this.defCfg).persist callback
    this
  ###*
    If the version differs the settings get updated and persisted.
    @param callback Gets called when done.
    @param force Whether to update and persist the settings even if the versions ara equal.
  ###
  checkStructure: (callback, force) ->
    if !force && this.cfg.version == this.version
      callback() if typeof callback == 'function'
    else
      mergeSettings this.cfg, this.defCfg
      this.cfg.version = this.version
      this.persist ->
        callback() if typeof callback == 'function'
    this

module.exports = Settings