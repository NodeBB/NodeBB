define ->
  # Note: You can get the key-objects of the field client-side by fetching the 'keyData' data of the input-fields!

  Settings = null
  helper = null

  class Key
    constructor: ->
      this.ctrl = false
      this.alt = false
      this.shift = false
      this.meta = false
      this.code = 0
      this.char = ''

  oldKey = null # gets displayed
  lastKey = null

  getKey = (event) ->
    modChange = event.ctrlKey + event.altKey + event.shiftKey + event.metaKey - lastKey.ctrl - lastKey.alt -
      lastKey.shift - lastKey.meta
    anyModChange = event.ctrlKey != lastKey.ctrl || event.altKey != lastKey.alt || event.shiftKey != lastKey.shift ||
      event.metaKey != lastKey.meta
    key = new Key()
    key.ctrl = event.ctrlKey
    key.alt = event.altKey
    key.shift = event.shiftKey
    key.meta = event.metaKey
    lastKey = key
    if anyModChange
      key.code = oldKey.code
      key.char = oldKey.char
      return oldKey if modChange < 0
    else
      key.code = event.which
      key.char = convertKeyCodeToChar key.code
    oldKey = key

  keyMap =
    0: '', 8: 'Backspace', 9: 'Tab', 13: 'Enter', 27: 'Escape', 32: 'Space', 37: 'Left', 38: 'Up', 39: 'Right',
    40: 'Down', 45: 'Insert', 46: 'Delete', 187: '=', 189: '-', 190: '.', 191: '/', 219: '[', 220: '\\', 221: ']'

  convertKeyCodeToChar = (code) ->
    code = +code
    if code == 0
      ''
    else if code >= 48 && code <= 90
      String.fromCharCode(code).toUpperCase()
    else if code >= 112 && code <= 123
      "F#{code - 111}"
    else
      keyMap[code] || "##{code}"

  getKeyString = (key, human = true, short = false, sep = ' + ') ->
    str = ''
    return str if !(key instanceof Key)
    sep = '+' if !/^(\s*[^CtrlAShifMea#]\s*|)$/.test(sep)
    str += (if short then 'C' else 'Ctrl') + sep if key.ctrl
    str += (if short then 'A' else 'Alt') + sep if key.alt
    str += (if short then 'S' else 'Shift') + sep if key.shift
    str += (if short then 'M' else 'Meta') + sep if key.meta
    str += if human then key.char || 'Enter a key' else if key.code then '#' + key.code else ''

  getKeyFromString = (str) ->
    return str if str instanceof Key
    key = new Key()
    sep = /([^CtrlAShifMea#\d]+)(?:#|\d)/.exec str
    parts = if sep? then str.split sep[1] else [str]
    for p in parts
      switch p
        when 'C', 'Ctrl' then key.ctrl = true
        when 'A', 'Alt' then key.alt = true
        when 'S', 'Shift' then key.shift = true
        when 'M', 'Meta' then key.meta = true
        else
          num = /\d+/.exec p
          key.code = num[0] if num?
          key.char = convertKeyCodeToChar key.code
    key

  SettingsKey =
    types: ['key']
    use: -> helper = (Settings = this).helper
    init: (element) ->
      element.focus ->
        oldKey = element.data('keyData') || new Key()
        lastKey = new Key()
      element.keydown (event) ->
        event.preventDefault()
        event = event || window.event
        event.which = event.which || event.keyCode || event.key
        SettingsKey.set element, getKey event
      element.keyup (event) ->
        event = event || window.event
        event.which = event.which || event.keyCode || event.key
        SettingsKey.set element, getKey event
    set: (element, value) ->
      key = getKeyFromString value || ''
      element.data 'keyData', key
      if key.code then element.removeClass 'alert-danger' else element.addClass 'alert-danger'
      element.val getKeyString key
    get: (element, trim, empty) ->
      short = !helper.isFalse element.data 'short'
      sep = element.data('split') || element.data('separator') || '+'
      if trim
        key = getKeyString element.data('keyData'), false, short, sep
        if empty || key then key else null
      else
        key = element.data 'keyData'
        if empty || key.code then key else null

  SettingsKey