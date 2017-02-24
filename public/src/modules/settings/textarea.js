'use strict';

define('settings/textarea', function () {
	var Settings = null;
	var SettingsArea;

	SettingsArea = {
		types: ['textarea'],
		use: function () {
			Settings = this;
		},
		create: function () {
			return Settings.helper.createElement('textarea');
		},
		set: function (element, value, trim) {
			if (trim && value != null && typeof value.trim === 'function') {
				value = value.trim();
			}
			element.val(value || '');
		},
		get: function (element, trim, empty) {
			var value = element.val();
			if (trim) {
				if (value == null) {
					value = undefined;
				} else {
					value = value.trim();
				}
			}
			if (empty || value) {
				return value;
			}
		},
	};

	return SettingsArea;
});
