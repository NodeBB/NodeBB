define('settings/checkbox', function () {

	var Settings = null,
		SettingsCheckbox;

	SettingsCheckbox = {
		types: ['checkbox'],
		use: function () {
			Settings = this;
		},
		create: function () {
			return Settings.helper.createElement('input', {
				type: 'checkbox'
			});
		},
		set: function (element, value) {
			element.prop('checked', value);
		},
		get: function (element, trim, empty) {
			var value = element.prop('checked');
			if (value == null) {
				return void 0;
			}
			if (!empty) {
				return value || void 0;
			}
			if (trim) {
				return value ? 1 : 0;
			}
			return value;
		}
	};

	return SettingsCheckbox;

});
