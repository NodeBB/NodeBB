'use strict';

module.exports = function (Messaging) {
	Messaging.deleteMessage = async mid => await doDeleteRestore(mid, 1);
	Messaging.restoreMessage = async mid => await doDeleteRestore(mid, 0);

	async function doDeleteRestore(mid, state) {
		const field = state ? 'deleted' : 'restored';
		const cur = await Messaging.getMessageField(mid, 'deleted');
		if (cur === state) {
			throw new Error('[[error:chat-' + field + '-already]]');
		}

		return await Messaging.setMessageField(mid, 'deleted', state);
	}
};
