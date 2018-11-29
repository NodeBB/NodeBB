'use strict';


/*
	The point of this library is to enhance(tm) a textarea so that if scrolled,
	you can only scroll to the top of it and the event doesn't bubble up to
	the document... because it does... and it's annoying at times.

	While I'm here, might I say this is a solved issue on Linux?
*/

define('scrollStop', function () {
	var Module = {};

	Module.apply = function (element) {
		$(element).on('mousewheel', function (e) {
			var scrollTop = this.scrollTop;
			var scrollHeight = this.scrollHeight;
			var elementHeight = Math.round(this.getBoundingClientRect().height);

			if (
				(e.originalEvent.deltaY < 0 && scrollTop === 0) || // scroll up
				(e.originalEvent.deltaY > 0 && (elementHeight + scrollTop) >= scrollHeight)	// scroll down
			) {
				return false;
			}
		});
	};

	return Module;
});
