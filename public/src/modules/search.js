define('search', ['navigator'], function(nav) {
	"use strict";
	/* globals socket, ajaxify */

	var Search = {};

	Search.query = function(term, callback) {
		// Detect if a tid was specified
		var topicSearch = term.match(/in:topic-([\d]+)/);

		if (!topicSearch) {
			term = term.replace(/^[ ?#]*/, '');
			ajaxify.go('search/' + term);
			callback();
		} else {
			var cleanedTerm = term.replace(topicSearch[0], ''),
				tid = topicSearch[1];

			Search.queryTopic(tid, cleanedTerm, callback);
		}
	};

	Search.queryTopic = function(tid, term, callback) {
		socket.emit('topics.search', {
			tid: tid,
			term: term
		}, function(err, pids) {
			var args = arguments;

			// Sort pids numerically & store
			Search.results = pids.sort(function(a, b) {
				return a-b;
			});

			if (!err && !ajaxify.currentPage.match(new RegExp('^topic/' + tid))) {
				ajaxify.go('topic/' + tid, function() {
					if (callback) callback.apply(null, args);
					Search.highlightResult(0);
				});
			} else {
				if (callback) callback.apply(null, args);
				Search.highlightResult(0);
			}
		});
	};

	Search.highlightResult = function(index) {
		socket.emit('posts.getPidIndex', Search.results[index], function(err, postIndex) {
			nav.scrollToPost(postIndex-1, true);	// why -1? Ask @barisusakli
		});
	};

	return Search;
});