define('settings/key', function () {

	var Settings = null,
		SettingsKey,
		helper = null,
		lastKey = null,
		oldKey = null,
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

	function Key() {
		this.c = false;
		this.a = false;
		this.s = false;
		this.m = false;
		this.code = 0;
		this.char = '';
	}

	/**
	 Returns either a Key-Object representing the given event or null if only modification-keys got released.
	 @param event The event to inspect.
	 @returns Key | null The Key-Object the focused element should be set to.
	 */
	function getKey(event) {
		var anyModChange = event.ctrlKey !== lastKey.c || event.altKey !== lastKey.a || event.shiftKey !== lastKey.s || event.metaKey !== lastKey.m,
			modChange = event.ctrlKey + event.altKey + event.shiftKey + event.metaKey - lastKey.c - lastKey.a - lastKey.s - lastKey.m,
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
	}

	/**
	 Returns the string that represents the given key-code.
	 @param code The key-code.
	 @returns String Representation of the given key-code.
	 */
	function convertKeyCodeToChar(code) {
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
	}

	/**
	 Returns a string to identify a Key-Object.
	 @param key The Key-Object that should get identified.
	 @param human Whether to show 'Enter a key' when key-char is empty.
	 @param short Whether to shorten modification-names to first character.
	 @param separator The separator between modification-names and key-char.
	 @returns String The string to identify the given key-object the given way.
	 */
	function getKeyString(key, human, short, separator) {
		var str = '';
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
		if (!separator || /CtrlAShifMea#/.test(separator)) {
			separator = human ? ' + ' : '+';
		}
		if (key.c) {
			str += (short ? 'C' : 'Ctrl') + separator;
		}
		if (key.a) {
			str += (short ? 'A' : 'Alt') + separator;
		}
		if (key.s) {
			str += (short ? 'S' : 'Shift') + separator;
		}
		if (key.m) {
			str += (short ? 'M' : 'Meta') + separator;
		}
		return str + (human ? key.char : key.code ? '#' + key.code : '');
	}

	/**
	 Parses the given string into a Key-Object.
	 @param str The string to parse.
	 @returns Key The Key-Object that got identified by the given string.
	 */
	function getKeyFromString(str) {
		if (str instanceof Key) {
			return str;
		}
		var key = new Key(),
			sep = /([^CtrlAShifMea#\d]+)(?:#|\d)/.exec(str),
			parts = sep != null ? str.split(sep[1]) : [str];
		for (var i = 0; i < parts.length; i++) {
			var part = parts[i];
			switch (part) {
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
				var num = /\d+/.exec(part);
				if (num != null) {
					key.code = num[0];
				}
				key.char = convertKeyCodeToChar(key.code);
			}
		}
		return key;
	}

	function handleEvent(element, event) {
		event = event || window.event;
		event.which = event.which || event.keyCode || event.key;
		var key = getKey(event);
		if (key != null) {
			SettingsKey.set(element, key);
		}
	}


	SettingsKey = {
		types: ['key'],
		use: function () {
			helper = (Settings = this).helper;
		},
		init: function (element) {
			element.focus(function () {
				oldKey = element.data('keyData') || new Key();
				lastKey = new Key();
			}).keydown(function (event) {
				event.preventDefault();
				handleEvent(element, event);
			}).keyup(function (event) {
				handleEvent(element, event);
			});
			return element;
		},
		set: function (element, value) {
			var key = getKeyFromString(value || '');
			element.data('keyData', key);
			if (key.code) {
				element.removeClass('alert-danger');
			} else {
				element.addClass('alert-danger');
			}
			element.val(getKeyString(key, true, false, ' + '));
		},
		get: function (element, trim, empty) {
			var key = element.data('keyData'),
				separator = element.data('split') || element.data('separator') || '+',
				short = !helper.isFalse(element.data('short'));
			if (trim) {
				if (empty || (key != null && key.char)) {
					return getKeyString(key, false, short, separator);
				} else {
					return void 0;
				}
			} else if (empty || (key != null && key.code)) {
				return key;
			} else {
				return void 0;
			}
		}
	};

	return SettingsKey;

});
