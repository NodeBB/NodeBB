'use strict';

define('settings/number', function () {
	return {
		types: ['number'],
		get: function (element, trim, empty) {
			const value = element.val();
			if (!empty) {
				if (value) {
					return +value;
				}
				return;
			}
			return value ? +value : 0;
		},
	};
});
