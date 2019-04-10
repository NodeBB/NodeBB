'use strict';


define('admin/modules/colorpicker', function () {
	var colorpicker = {};

	colorpicker.enable = function (inputEl, callback) {
		(inputEl instanceof jQuery ? inputEl : $(inputEl)).each(function () {
			var $this = $(this);

			$this.ColorPicker({
				color: $this.val() || '#000',
				onChange: function (hsb, hex) {
					$this.val('#' + hex);
					if (typeof callback === 'function') {
						callback(hsb, hex);
					}
				},
				onShow: function (colpkr) {
					$(colpkr).css('z-index', 1051);
				},
			});

			$(window).one('action:ajaxify.start', function () {
				$this.ColorPickerHide();
			});
		});
	};

	return colorpicker;
});
