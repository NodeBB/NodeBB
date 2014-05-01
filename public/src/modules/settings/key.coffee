define ->
  # Note: You can get the key-objects of the field client-side by fetching the 'keyData' data of the input-fields!

  Settings = null
  helper = null

  class Key
    constructor: ->
      this.c = false
      this.a = false
      this.s = false
      this.m = false
      this.code = 0
      this.char = ''

  ###*
    Always the key-value of the focused element.
  ###
  oldKey = null
  ###*
    The Key-Object of the last key that got pressed.
  ###
  lastKey = null

  keyMap = Object.freeze
    0: '', 8: 'Backspace', 9: 'Tab', 13: 'Enter', 27: 'Escape', 32: 'Space', 37: 'Left', 38: 'Up', 39: 'Right',
    40: 'Down', 45: 'Insert', 46: 'Delete', 187: '=', 189: '-', 190: '.', 191: '/', 219: '[', 220: '\\', 221: ']'

  ###*
    Returns either a Key-Object representing the given event or null if only modification-keys got released.
    @param event The event to inspect.
    @returns Key | null The Key-Object the focused element should be set to.
  ###
  getKey = (event) ->
    anyModChange = event.ctrlKey != lastKey.c || event.altKey != lastKey.a || event.shiftKey != lastKey.s || event.metaKey != lastKey.m
    modChange = event.ctrlKey + event.altKey + event.shiftKey + event.metaKey - lastKey.c - lastKey.a - lastKey.s - lastKey.m
    key = new Key()
    key.c = event.ctrlKey
    key.a = event.altKey
    key.s = event.shiftKey
    key.m = event.metaKey
    lastKey = key
    if anyModChange
      return null if modChange < 0
      key.code = oldKey.code
      key.char = oldKey.char
    else
      key.code = event.which
      key.char = convertKeyCodeToChar key.code
    oldKey = key

  ###*
    Returns the string that represents the given key-code.
    @param code The key-code.
    @returns String Representation of the given key-code.
  ###
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

  ###*
    Returns a string to identify a Key-Object.
    @param key The Key-Object that should get identified.
    @param human Whether to show 'Enter a key' when key-char is empty.
    @param short Whether to shorten modification-names to first character.
    @param sep The separator between modification-names and key-char.
    @returns String The string to identify the given key-object the given way.
  ###
  getKeyString = (key, human = true, short = false, sep = ' + ') ->
    str = ''
    return str if !(key instanceof Key)
    if !key.char
      return if human then 'Enter a key' else ''
    sep = '+' if !/^(\s*[^CtrlAShifMea#]\s*|)$/.test(sep)
    str += (if short then 'C' else 'Ctrl') + sep if key.c
    str += (if short then 'A' else 'Alt') + sep if key.a
    str += (if short then 'S' else 'Shift') + sep if key.s
    str += (if short then 'M' else 'Meta') + sep if key.m
    str += if human then key.char else if key.code then '#' + key.code else ''

  ###*
    Parses the given string into a Key-Object.
    @param str The string to parse.
    @returns Key The Key-Object that got identified by the given string.
  ###
  getKeyFromString = (str) ->
    return str if str instanceof Key
    key = new Key()
    sep = /([^CtrlAShifMea#\d]+)(?:#|\d)/.exec str
    parts = if sep? then str.split sep[1] else [str]
    for p in parts
      switch p
        when 'C', 'Ctrl' then key.c = true
        when 'A', 'Alt' then key.a = true
        when 'S', 'Shift' then key.s = true
        when 'M', 'Meta' then key.m = true
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
        SettingsKey.set element, key if (key = getKey event)?
      element.keyup (event) ->
        event = event || window.event
        event.which = event.which || event.keyCode || event.key
        SettingsKey.set element, key if (key = getKey event)?
    set: (element, value) ->
      key = getKeyFromString value || ''
      element.data 'keyData', key
      if key.code then element.removeClass 'alert-danger' else element.addClass 'alert-danger'
      element.val getKeyString key
    get: (element, trim, empty) ->
      short = !helper.isFalse element.data 'short'
      sep = element.data('split') || element.data('separator') || '+'
      key = element.data 'keyData'
      if trim
        if empty || key?.char then getKeyString key, false, short, sep else undefined
      else if empty || key?.code then key else undefined

  SettingsKey