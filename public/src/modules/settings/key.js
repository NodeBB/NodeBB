define(function () {
	var Key, Settings, SettingsKey, convertKeyCodeToChar, getKey, getKeyFromString, getKeyString, helper, keyMap, lastKey, oldKey;
	Settings = null;
	helper = null;
	Key = (function () {
		function Key() {
			this.c = false;
			this.a = false;
			this.s = false;
			this.m = false;
			this.code = 0;
			this.char = '';
		}

		return Key;

	})();

	/**
    Always the key-value of the focused element.
   */
	oldKey = null;

	/**
    The Key-Object of the last key that got pressed.
   */
	lastKey = null;
	keyMap = Object.freeze({
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
	});

	/**
    Returns either a Key-Object representing the given event or null if only modification-keys got released.
    @param event The event to inspect.
    @returns Key | null The Key-Object the focused element should be set to.
   */
	getKey = function (event) {
		var anyModChange, key, modChange;
		anyModChange = event.ctrlKey !== lastKey.c || event.altKey !== lastKey.a || event.shiftKey !== lastKey.s || event.metaKey !== lastKey.m;
		modChange = event.ctrlKey + event.altKey + event.shiftKey + event.metaKey - lastKey.c - lastKey.a - lastKey.s - lastKey.m;
		key = new Key();
		key.c = event.ctrlKey;
		key.a = event.altKey;
		key.s = event.shiftKey;
		key.m = event.metaKey;
		lastKey = key;
		if (anyModChange) {
			if (modChange < 0) {
				return null;
			}
			key.code = oldKey.code;
			key.char = oldKey.char;
		} else {
			key.code = event.which;
			key.char = convertKeyCodeToChar(key.code);
		}
		return oldKey = key;
	};

	/**
    Returns the string that represents the given key-code.
    @param code The key-code.
    @returns String Representation of the given key-code.
   */
	convertKeyCodeToChar = function (code) {
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

	/**
    Returns a string to identify a Key-Object.
    @param key The Key-Object that should get identified.
    @param human Whether to show 'Enter a key' when key-char is empty.
    @param short Whether to shorten modification-names to first character.
    @param sep The separator between modification-names and key-char.
    @returns String The string to identify the given key-object the given way.
   */
	getKeyString = function (key, human, short, sep) {
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
		if (!key.char) {
			if (human) {
				return 'Enter a key';
			} else {
				return '';
			}
		}
		if (!/^(\s*[^CtrlAShifMea#]\s*|)$/.test(sep)) {
			sep = '+';
		}
		if (key.c) {
			str += (short ? 'C' : 'Ctrl') + sep;
		}
		if (key.a) {
			str += (short ? 'A' : 'Alt') + sep;
		}
		if (key.s) {
			str += (short ? 'S' : 'Shift') + sep;
		}
		if (key.m) {
			str += (short ? 'M' : 'Meta') + sep;
		}
		return str += human ? key.char : key.code ? '#' + key.code : '';
	};

	/**
    Parses the given string into a Key-Object.
    @param str The string to parse.
    @returns Key The Key-Object that got identified by the given string.
   */
	getKeyFromString = function (str) {
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
				key.c = true;
				break;
			case 'A':
			case 'Alt':
				key.a = true;
				break;
			case 'S':
			case 'Shift':
				key.s = true;
				break;
			case 'M':
			case 'Meta':
				key.m = true;
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
		use: function () {
			return helper = (Settings = this).helper;
		},
		init: function (element) {
			element.focus(function () {
				oldKey = element.data('keyData') || new Key();
				return lastKey = new Key();
			});
			element.keydown(function (event) {
				var key;
				event.preventDefault();
				event = event || window.event;
				event.which = event.which || event.keyCode || event.key;
				if ((key = getKey(event)) != null) {
					return SettingsKey.set(element, key);
				}
			});
			return element.keyup(function (event) {
				var key;
				event = event || window.event;
				event.which = event.which || event.keyCode || event.key;
				if ((key = getKey(event)) != null) {
					return SettingsKey.set(element, key);
				}
			});
		},
		set: function (element, value) {
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
		get: function (element, trim, empty) {
			var key, sep, short;
			short = !helper.isFalse(element.data('short'));
			sep = element.data('split') || element.data('separator') || '+';
			key = element.data('keyData');
			if (trim) {
				if (empty || (key != null ? key.char : void 0)) {
					return getKeyString(key, false, short, sep);
				} else {
					return void 0;
				}
			} else if (empty || (key != null ? key.code : void 0)) {
				return key;
			} else {
				return void 0;
			}
		}
	};
	return SettingsKey;
});
