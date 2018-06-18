
'use strict';

module.exports = function (Topics) {
	Topics.getPopularTopics = function (term, uid, start, stop, callback) {
		Topics.getSortedTopics({
			uid: uid,
			start: start,
			stop: stop,
			term: term,
			sort: 'posts',
		}, callback);
	};
};
