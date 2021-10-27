'use strict';


define('admin/modules/selectable', [
	'jquery-ui/widgets/selectable',
], function () {
	const selectable = {};

	selectable.enable = function (containerEl, targets) {
		$(containerEl).selectable({
			filter: targets,
		});
	};

	return selectable;
});
