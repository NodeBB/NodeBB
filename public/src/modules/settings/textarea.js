define(function () {
	var Settings, SettingsArea;
	Settings = null;
	SettingsArea = {
		types: ['textarea'],
		use: function () {
			return Settings = this;
		},
		create: function () {
			return Settings.helper.createElement('textarea');
		},
		set: function (element, value, trim) {
			return element.val(trim && typeof (value != null ? value.trim : void 0) === 'function' ? value.trim() : value || '');
		},
		get: function (element, trim, empty) {
			var val, _ref;
			val = trim ? (_ref = element.val()) != null ? _ref.trim() : void 0 : element.val();
			if (empty || val) {
				return val;
			} else {
				return void 0;
			}
		}
	};
	return SettingsArea;
});
