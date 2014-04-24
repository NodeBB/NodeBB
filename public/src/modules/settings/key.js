define(function() {
  var Key, Settings, SettingsKey, convertKeyCodeToChar, getKey, getKeyFromString, getKeyString, helper, keyMap, lastKey, oldKey;
  Settings = null;
  helper = null;
  Key = (function() {
    function Key() {
      this.ctrl = false;
      this.alt = false;
      this.shift = false;
      this.meta = false;
      this.code = 0;
      this.char = '';
    }

    return Key;

  })();
  oldKey = null;
  lastKey = null;
  getKey = function(event) {
    var anyModChange, key, modChange;
    modChange = event.ctrlKey + event.altKey + event.shiftKey + event.metaKey - lastKey.ctrl - lastKey.alt - lastKey.shift - lastKey.meta;
    anyModChange = event.ctrlKey !== lastKey.ctrl || event.altKey !== lastKey.alt || event.shiftKey !== lastKey.shift || event.metaKey !== lastKey.meta;
    key = new Key();
    key.ctrl = event.ctrlKey;
    key.alt = event.altKey;
    key.shift = event.shiftKey;
    key.meta = event.metaKey;
    lastKey = key;
    if (anyModChange) {
      key.code = oldKey.code;
      key.char = oldKey.char;
      if (modChange < 0) {
        return oldKey;
      }
    } else {
      key.code = event.which;
      key.char = convertKeyCodeToChar(key.code);
    }
    return oldKey = key;
  };
  keyMap = {
    0: '',
    8: 'Backspace',
    9: 'Tab',
    13: 'Enter',
    27: 'Escape',
    32: 'Space',
    37: 'Left',
    38: 'Up',
    39: 'Right',
    40: 'Down',
    45: 'Insert',
    46: 'Delete',
    187: '=',
    189: '-',
    190: '.',
    191: '/',
    219: '[',
    220: '\\',
    221: ']'
  };
  convertKeyCodeToChar = function(code) {
    code = +code;
    if (code === 0) {
      return '';
    } else if (code >= 48 && code <= 90) {
      return String.fromCharCode(code).toUpperCase();
    } else if (code >= 112 && code <= 123) {
      return "F" + (code - 111);
    } else {
      return keyMap[code] || ("#" + code);
    }
  };
  getKeyString = function(key, human, short, sep) {
    var str;
    if (human == null) {
      human = true;
    }
    if (short == null) {
      short = false;
    }
    if (sep == null) {
      sep = ' + ';
    }
    str = '';
    if (!(key instanceof Key)) {
      return str;
    }
    if (!/^(\s*[^CtrlAShifMea#]\s*|)$/.test(sep)) {
      sep = '+';
    }
    if (key.ctrl) {
      str += (short ? 'C' : 'Ctrl') + sep;
    }
    if (key.alt) {
      str += (short ? 'A' : 'Alt') + sep;
    }
    if (key.shift) {
      str += (short ? 'S' : 'Shift') + sep;
    }
    if (key.meta) {
      str += (short ? 'M' : 'Meta') + sep;
    }
    return str += human ? key.char || 'Enter a key' : key.code ? '#' + key.code : '';
  };
  getKeyFromString = function(str) {
    var key, num, p, parts, sep, _i, _len;
    if (str instanceof Key) {
      return str;
    }
    key = new Key();
    sep = /([^CtrlAShifMea#\d]+)(?:#|\d)/.exec(str);
    parts = sep != null ? str.split(sep[1]) : [str];
    for (_i = 0, _len = parts.length; _i < _len; _i++) {
      p = parts[_i];
      switch (p) {
        case 'C':
        case 'Ctrl':
          key.ctrl = true;
          break;
        case 'A':
        case 'Alt':
          key.alt = true;
          break;
        case 'S':
        case 'Shift':
          key.shift = true;
          break;
        case 'M':
        case 'Meta':
          key.meta = true;
          break;
        default:
          num = /\d+/.exec(p);
          if (num != null) {
            key.code = num[0];
          }
          key.char = convertKeyCodeToChar(key.code);
      }
    }
    return key;
  };
  SettingsKey = {
    types: ['key'],
    use: function() {
      return helper = (Settings = this).helper;
    },
    init: function(element) {
      element.focus(function() {
        oldKey = element.data('keyData') || new Key();
        return lastKey = new Key();
      });
      element.keydown(function(event) {
        event.preventDefault();
        event = event || window.event;
        event.which = event.which || event.keyCode || event.key;
        return SettingsKey.set(element, getKey(event));
      });
      return element.keyup(function(event) {
        event = event || window.event;
        event.which = event.which || event.keyCode || event.key;
        return SettingsKey.set(element, getKey(event));
      });
    },
    set: function(element, value) {
      var key;
      key = getKeyFromString(value || '');
      element.data('keyData', key);
      if (key.code) {
        element.removeClass('alert-danger');
      } else {
        element.addClass('alert-danger');
      }
      return element.val(getKeyString(key));
    },
    get: function(element, trim, empty) {
      var key, sep, short;
      short = !helper.isFalse(element.data('short'));
      sep = element.data('split') || element.data('separator') || '+';
      if (trim) {
        key = getKeyString(element.data('keyData'), false, short, sep);
        if (empty || key) {
          return key;
        } else {
          return null;
        }
      } else {
        key = element.data('keyData');
        if (empty || key.code) {
          return key;
        } else {
          return null;
        }
      }
    }
  };
  return SettingsKey;
});
