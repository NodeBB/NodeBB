'use strict';

export default  function (module) {
	// TODO
	module.transaction = function (perform, callback) {
		perform(module.client, callback);
	};
};
