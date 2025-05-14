'use strict';

class BuildCustomTemplatesTask {
	/**
     * @param {Promise<void>} promise
     */
	constructor(promise) {
		/** @type {boolean} */
		this.resolved = false;

		/** @type {Promise<void>} */
		this.promise = promise;
		promise.then(() => this.resolved = true);
	}
}

export default BuildCustomTemplatesTask;