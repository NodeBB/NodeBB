'use strict';

import BuildCustomTemplatesTask from "./BuildCustomTemplatesTask.mjs";

class BuildCustomTemplatesTasks {
	constructor() {
		/**
         * @type {BuildCustomTemplatesTask[]}
         */
		this.promises = [];
	}

	/**
     *
     * @param {Promise<void>} promise
     */
	push(promise) {
		this.promises.push(new BuildCustomTemplatesTask(promise));
		this.clean();
	}

	async awaitAll() {
		await Promise.all(this.promises.map(promise => promise.promise));
		this.clean();
	}

	clean() {
		for (let i = this.promises.length - 1; i >= 0; i--) {
			if (this.promises[i].resolved) {
				this.promises.splice(i, 1);
			}
		}
	}
}

export default BuildCustomTemplatesTasks;