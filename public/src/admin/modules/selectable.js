'use strict';


define('admin/modules/selectable', ['jqueryui'], function () {
	var selectable = {};

	selectable.enable = function (containerEl, targets) {
		$(containerEl).selectable({
			filter: targets,
		});
	};

	return selectable;
});
