

'use strict';

module.exports = function (Topics) {
	Topics.getTopTopics = function (cid, uid, start, stop, filter, callback) {
		Topics.getSortedTopics({
			cids: cid,
			uid: uid,
			start: start,
			stop: stop,
			filter: filter,
			sort: 'votes',
		}, callback);
	};
};
