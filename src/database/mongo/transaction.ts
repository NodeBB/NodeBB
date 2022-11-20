'use strict';

export default  function (module) {
	// TODO
	module.transaction = function (perform, callback: Function) {
		perform(module.client, callback);
	};
};
