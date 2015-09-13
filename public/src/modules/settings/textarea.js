define('settings/textarea', function () {

	var Settings = null,
		SettingsArea;

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
				value = value == null ? void 0 : value.trim();
			}
			if (empty || value) {
				return value;
			} else {
				return void 0;
			}
		}
	};

	return SettingsArea;

});
