"use strict";

/*globals define*/

define('admin/modules/selectable', function() {
	var selectable = {};

	selectable.enable = function(containerEl, targets) {
		app.loadJQueryUI(function() {
			$(containerEl).selectable({
				filter: targets
			});
		});
	};

	return selectable;
});
