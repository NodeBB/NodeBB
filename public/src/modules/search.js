"use strict";
/* globals socket, ajaxify, app, define, config */

define('search', ['navigator', 'translator'], function(nav, translator) {

	var Search = {
			current: {}
		};

	Search.query = function(data, callback) {
		var term = data.term;

		// Detect if a tid was specified
		var topicSearch = term.match(/^in:topic-([\d]+) /);

		if (!topicSearch) {
			term = term.replace(/^[ ?#]*/, '');

			try {
				term = encodeURIComponent(term);
			} catch(e) {
				return app.alertError('[[error:invalid-search-term]]');
			}

			ajaxify.go('search/' + term + '?' + createQueryString(data));
			callback();
		} else {
			var cleanedTerm = term.replace(topicSearch[0], ''),
				tid = topicSearch[1];

			if (cleanedTerm.length > 0) {
				Search.queryTopic(tid, cleanedTerm, callback);
			}
		}
	};

	function createQueryString(data) {
		var searchIn = data['in'] || 'titlesposts';
		var postedBy = data.by || '';
		var query = {
				'in': searchIn
			};

		if (postedBy && (searchIn === 'posts' || searchIn === 'titles' || searchIn === 'titlesposts')) {
			query.by = postedBy;
		}

		if (data.categories && data.categories.length) {
			query.categories = data.categories;
			if (data.searchChildren) {
				query.searchChildren = data.searchChildren;
			}
		}

		if (parseInt(data.replies, 10) > 0) {
			query.replies = data.replies;
			query.repliesFilter = data.repliesFilter || 'atleast';
		}

		if (data.timeRange) {
			query.timeRange = data.timeRange;
			query.timeFilter = data.timeFilter || 'newer';
		}

		if (data.sortBy) {
			query.sortBy = data.sortBy;
			query.sortDirection = data.sortDirection;
		}

		if (data.showAs) {
			query.showAs = data.showAs;
		}
		return decodeURIComponent($.param(query));
	}

	Search.queryTopic = function(tid, term, callback) {
		socket.emit('topics.search', {
			tid: tid,
			term: term
		}, function(err, pids) {
			if (err) {
				return app.alertError(err.message);
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

				Search.checkPagePresence(tid, function() {
					Search.topicDOM.update(0);
				});
			}
		});
	};

	Search.checkPagePresence = function(tid, callback) {
		if (parseInt(ajaxify.data.tid, 10) !== parseInt(tid, 10)) {
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

		if (Search.current.results.length > 0) {
			topicSearchEl.find('.count').html((index+1) + ' / ' + Search.current.results.length);
			topicSearchEl.find('.prev, .next').removeAttr('disabled');
			var data = {
				pid: Search.current.results[index],
				tid: Search.current.tid,
				topicPostSort: config.topicPostSort
			};
			socket.emit('posts.getPidIndex', data, function(err, postIndex) {
				nav.scrollToPost(postIndex, true);
			});
		} else {
			translator.translate('[[search:no-matches]]', function(text) {
				topicSearchEl.find('.count').html(text);
			});
			topicSearchEl.removeClass('hidden').find('.prev, .next').attr('disabled', 'disabled');
		}
	};

	Search.topicDOM.start = function() {
		$('.topic-search').removeClass('hidden');
		if (!Search.topicDOM.active) {
			Search.topicDOM.active = true;

			// Bind to esc
			require(['mousetrap'], function(mousetrap) {
				mousetrap.bind('esc', Search.topicDOM.end);
			});
		}
	};

	Search.topicDOM.end = function() {
		$('.topic-search').addClass('hidden').find('.prev, .next').attr('disabled', 'disabled');
		Search.topicDOM.active = false;

		// Unbind esc
		require(['mousetrap'], function(mousetrap) {
			mousetrap.unbind('esc', Search.topicDOM.end);
		});
	};

	return Search;
});