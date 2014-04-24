meta = require './meta'

merge = (obj1, obj2) ->
  for key, val2 of obj2
    val1 = obj1[key]
    if !obj1.hasOwnProperty key
      obj1[key] = val2
    else if typeof val2 != typeof val1
      obj1[key] = val2
    else if typeof val2 == 'object'
      merge val1, val2
  obj1

trim = (obj1, obj2) ->
  for key, val1 of obj1
    if !obj2.hasOwnProperty key
      delete obj1[key]
    else if typeof val1 == 'object'
      trim val1, obj2[key]
  obj1

mergeSettings = (cfg, defCfg) ->
  if typeof cfg._settings != typeof defCfg || typeof defCfg != 'object'
    cfg._settings = defCfg
  else
    merge cfg._settings, defCfg
    trim cfg._settings, defCfg

class Settings
  hash: ''
  defCfg: {}
  cfg: {}
  version: '0.0.0'
  constructor: (id, version, defCfg, callback, forceUpdate, reset) ->
    this.hash = id
    this.version = version || this.version
    this.defCfg = defCfg
    if reset
      this.reset callback
    else
      this.sync ->
        this.checkStructure forceUpdate, callback
  sync: (callback) ->
    _this = this
    meta.settings.get this.hash, (err, settings) ->
      try settings._settings = JSON.parse settings._settings if settings._settings
      _this.cfg = settings
      callback.apply _this, err if typeof callback == 'function'
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
  persistOnEmpty: (callback) ->
    _this = this
    meta.settings.get this.hash, (err, settings) ->
      if !settings
        _this.persist callback
      else if typeof callback == 'function'
        callback.call _this
    this
  get: (key = '', def = null) ->
    obj = this.cfg._settings
    parts = key.split '.'
    obj = obj[k] for k in parts when k && obj?
    if !obj?
      if !def
        def = this.defCfg
        def = def[k] for k in parts when k && def?
      return def
    obj
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
  reset: (callback) ->
    this.set(this.defCfg).persist ->
      callback() if typeof callback == 'function'
    this
  checkStructure: (force, callback) ->
    if !force && this.cfg.version == this.version
      callback() if typeof callback == 'function'
    else
      mergeSettings this.cfg, this.defCfg
      this.cfg.version = this.version
      this.persist ->
        callback() if typeof callback == 'function'
    this

module.exports = Settings