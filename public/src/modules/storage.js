'use strict';

/**
 * Checks localStorage and provides a fallback if it doesn't exist or is disabled
 */
define('storage', function () {
	function Storage() {
		this._store = {};
		this._keys = [];
	}
	Storage.prototype.isMock = true;
	Storage.prototype.setItem = function (key, val) {
		key = String(key);
		if (this._keys.indexOf(key) === -1) {
			this._keys.push(key);
		}
		this._store[key] = val;
	};
	Storage.prototype.getItem = function (key) {
		key = String(key);
		if (this._keys.indexOf(key) === -1) {
			return null;
		}

		return this._store[key];
	};
	Storage.prototype.removeItem = function (key) {
		key = String(key);
		this._keys = this._keys.filter(function (x) {
			return x !== key;
		});
		this._store[key] = null;
	};
	Storage.prototype.clear = function () {
		this._keys = [];
		this._store = {};
	};
	Storage.prototype.key = function (n) {
		n = parseInt(n, 10) || 0;
		return this._keys[n];
	};
	if (Object.defineProperty) {
		Object.defineProperty(Storage.prototype, 'length', {
			get: function () {
				return this._keys.length;
			},
		});
	}

	var storage;
	var item = Date.now().toString();

	try {
		storage = window.localStorage;
		storage.setItem(item, item);
		if (storage.getItem(item) !== item) {
			throw Error('localStorage behaved unexpectedly');
		}
		storage.removeItem(item);

		return storage;
	} catch (e) {
		console.warn(e);
		console.warn('localStorage failed, falling back on sessionStorage');

		// see if sessionStorage works, and if so, return that
		try {
			storage = window.sessionStorage;
			storage.setItem(item, item);
			if (storage.getItem(item) !== item) {
				throw Error('sessionStorage behaved unexpectedly');
			}
			storage.removeItem(item);

			return storage;
		} catch (e) {
			console.warn(e);
			console.warn('sessionStorage failed, falling back on memory storage');

			// return an object implementing mock methods
			return new Storage();
		}
	}
});
