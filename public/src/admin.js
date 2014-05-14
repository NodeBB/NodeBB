"use strict";

var admin = {};

(function() {

	admin.enableColorPicker = function(inputEl, callback) {
		inputEl.ColorPicker({
			color: inputEl.val() || '#000',
			onChange: function(hsb, hex) {
				inputEl.val('#' + hex);
				if (typeof callback === 'function') {
					callback(hsb, hex);
				}
			}
		});
	};

}());