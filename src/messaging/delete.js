'use strict';

module.exports = function (Messaging) {
	Messaging.deleteMessage = async (mid) => {
		const deleted = await Messaging.getMessageField(mid, 'deleted');
		if (deleted) {
			throw new Error('[[error:chat-deleted-already]]');
		}

		return await Messaging.setMessageField(mid, 'deleted', 1);
	};

	Messaging.restoreMessage = async (mid) => {
		const deleted = await Messaging.getMessageField(mid, 'deleted');
		if (!deleted) {
			throw new Error('[[error:chat-restored-already]]');
		}

		return await Messaging.setMessageField(mid, 'deleted', 0);
	};
};
