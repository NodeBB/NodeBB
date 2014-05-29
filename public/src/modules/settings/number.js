define('settings/number', function () {

	return {
		types: ['number'],
		get: function (element, trim, empty) {
			var value = element.val();
			if (!empty) {
				return value ? +value : void 0;
			}
			return value ? +value : 0;
		}
	};

});
