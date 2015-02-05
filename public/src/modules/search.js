"use strict";
/* globals socket, ajaxify, translator, app, define */

define('search', ['navigator'], function(nav) {

	var Search = {
			current: {}
		};

	Search.query = function(data, callback) {
		var term = data.term;
		var searchIn = data.in || 'posts';
		var postedBy = data.by || '';

		// Detect if a tid was specified
		var topicSearch = term.match(/in:topic-([\d]+)/);

		if (!topicSearch) {
			term = term.replace(/^[ ?#]*/, '');

			try {
				term = encodeURIComponent(term);
			} catch(e) {
				return app.alertError('[[error:invalid-search-term]]');
			}
			var query = {in: searchIn};
			if (postedBy && searchIn === 'posts') {
				query.by = postedBy;
			}

			if (data.categories && data.categories.length) {
				query.categories = data.categories;
				if (data.searchChildren) {
					query.searchChildren = data.searchChildren;
				}
			}
			ajaxify.go('search/' + term + '?' + decodeURIComponent($.param(query)));
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
			if (err) {
				return callback(err);
			}

			if (Array.isArray(pids)) {
				// Sort pids numerically & store
				Search.current = {
					results: pids.sort(function(a, b) {
						return a-b;
					}),
					tid: tid,
					term: term
				};

				Search.topicDOM.update(0);
			}
		});
	};

	Search.checkPagePresence = function(tid, callback) {
		if (!ajaxify.currentPage.match(new RegExp('^topic/' + tid))) {
			ajaxify.go('topic/' + tid, callback);
		} else {
			callback();
		}
	};

	Search.topicDOM = {
		active: false
	};

	Search.topicDOM.prev = function() {
		Search.topicDOM.update((Search.current.index === 0) ? Search.current.results.length-1 : Search.current.index-1);
	};

	Search.topicDOM.next = function() {
		Search.topicDOM.update((Search.current.index === Search.current.results.length-1) ? 0 : Search.current.index+1);
	};

	Search.topicDOM.update = function(index) {
		var topicSearchEl = $('.topic-search');
		Search.current.index = index;

		Search.topicDOM.start();

		Search.checkPagePresence(Search.current.tid, function() {
			if (Search.current.results.length > 0) {
				topicSearchEl.find('.count').html((index+1) + ' / ' + Search.current.results.length);
				topicSearchEl.find('.prev, .next').removeAttr('disabled');
				socket.emit('posts.getPidIndex', Search.current.results[index], function(err, postIndex) {
					nav.scrollToPost(postIndex-1, true);	// why -1? Ask @barisusakli
				});
			} else {
				translator.translate('[[search:no-matches]]', function(text) {
					topicSearchEl.find('.count').html(text);
				});
				topicSearchEl.removeClass('hidden').find('.prev, .next').attr('disabled', 'disabled');
			}
		});
	};

	Search.topicDOM.start = function() {
		$('.topic-search').removeClass('hidden');
		if (!Search.topicDOM.active) {
			Search.topicDOM.active = true;

			// Bind to esc
			require(['mousetrap'], function(Mousetrap) {
				Mousetrap.bind('esc', Search.topicDOM.end);
			});
		}
	};

	Search.topicDOM.end = function() {
		$('.topic-search').addClass('hidden').find('.prev, .next').attr('disabled', 'disabled');
		Search.topicDOM.active = false;

		// Unbind esc
		require(['mousetrap'], function(Mousetrap) {
			Mousetrap.unbind('esc', Search.topicDOM.end);
		});
	};

	return Search;
});