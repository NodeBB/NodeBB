'use strict';

define('settings/select', function () {
	var Settings = null;
	var SettingsSelect;

	function addOptions(element, options) {
		for (var i = 0; i < options.length; i += 1) {
			var optionData = options[i];
			var value = optionData.text || optionData.value;
			delete optionData.text;
			element.append($(Settings.helper.createElement('option', optionData)).text(value));
		}
	}


	SettingsSelect = {
		types: ['select'],
		use: function () {
			Settings = this;
		},
		create: function (ignore, ignored, data) {
			var element = $(Settings.helper.createElement('select'));
			// prevent data-options from being attached to DOM
			addOptions(element, data['data-options']);
			delete data['data-options'];
			return element;
		},
		init: function (element) {
			var options = element.data('options');
			if (options != null) {
				addOptions(element, options);
			}
		},
		set: function (element, value) {
			element.val(value || '');
		},
		get: function (element, ignored, empty) {
			var value = element.val();
			if (empty || value) {
				return value;
			}
		},
	};

	return SettingsSelect;
});
