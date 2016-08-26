"use strict";

/*globals define*/

define('admin/modules/selectable', function() {
	var selectable = {};

	selectable.enable = function(containerEl, targets) {
		$(containerEl).selectable({
			filter: targets
		});
	};

	return selectable;
});
