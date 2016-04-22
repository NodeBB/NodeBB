'use strict';


/* globals define, app, socket, config, ajaxify, RELATIVE_PATH, utils */

define('forum/topic', [
	'forum/infinitescroll',
	'forum/topic/threadTools',
	'forum/topic/postTools',
	'forum/topic/events',
	'forum/topic/posts',
	'navigator',
	'sort',
	'components'
], function(infinitescroll, threadTools, postTools, events, posts, navigator, sort, components) {
	var	Topic = {},
		currentUrl = '';

	$(window).on('action:ajaxify.start', function(ev, data) {
		if (Topic.replaceURLTimeout) {
			clearTimeout(Topic.replaceURLTimeout);
			Topic.replaceURLTimeout = 0;
		}

		if (ajaxify.currentPage !== data.url) {
			navigator.disable();
			components.get('navbar/title').find('span').text('').hide();
			app.removeAlert('bookmark');

			events.removeListeners();
			$(window).off('keydown', onKeyDown);
		}

		if (!data.url.startsWith('topic/')) {
			require(['search'], function(search) {
				if (search.topicDOM.active) {
					search.topicDOM.end();
				}
			});
		}
	});

	Topic.init = function() {
		var tid = ajaxify.data.tid;

		$(window).trigger('action:topic.loading');

		app.enterRoom('topic_' + tid);

		posts.processPage(components.get('post'));

		postTools.init(tid);
		threadTools.init(tid);
		events.init();

		sort.handleSort('topicPostSort', 'user.setTopicSort', 'topic/' + ajaxify.data.slug);

		enableInfiniteLoadingOrPagination();

		addBlockQuoteHandler();

		addParentHandler();

		handleKeys();

		navigator.init('[component="post/anchor"]', ajaxify.data.postcount, Topic.toTop, Topic.toBottom, Topic.navigatorCallback, Topic.calculateIndex);

		handleBookmark(tid);

		$(window).on('scroll', updateTopicTitle);

		handleTopicSearch();

		$(window).trigger('action:topic.loaded');
	};

	function handleKeys() {
		if (!config.usePagination) {
			$(window).off('keydown', onKeyDown).on('keydown', onKeyDown);
		}
	}

	function onKeyDown(ev) {
		if (ev.target.nodeName === 'BODY') {
			if (ev.shiftKey || ev.ctrlKey || ev.altKey) {
				return;
			}
			if (ev.which === 36) { // home key
				Topic.toTop();
				return false;
			} else if (ev.which === 35) { // end key
				Topic.toBottom();
				return false;
			}
		}
	}

	function handleTopicSearch() {
		require(['search', 'mousetrap'], function(search, mousetrap) {
			$('.topic-search')
				.on('click', '.prev', function() {
					search.topicDOM.prev();
				})
				.on('click', '.next', function() {
					search.topicDOM.next();
				});

			mousetrap.bind('ctrl+f', function(e) {
				if (config.topicSearchEnabled) {
					// If in topic, open search window and populate, otherwise regular behaviour
					var match = ajaxify.currentPage.match(/^topic\/([\d]+)/),
						tid;
					if (match) {
						e.preventDefault();
						tid = match[1];
						$('#search-fields input').val('in:topic-' + tid + ' ');
						app.prepareSearch();
					}
				}
			});
		});
	}

	Topic.toTop = function() {
		navigator.scrollTop(0);
	};

	Topic.toBottom = function() {
		socket.emit('topics.postcount', ajaxify.data.tid, function(err, postCount) {
			if (config.topicPostSort !== 'oldest_to_newest') {
				postCount = 2;
			}
			navigator.scrollBottom(postCount - 1);
		});
	};

	function handleBookmark(tid) {
		// use the user's bookmark data if available, fallback to local if available
		var bookmark = ajaxify.data.bookmark || localStorage.getItem('topic:' + tid + ':bookmark');
		var postIndex = getPostIndex();

		if (postIndex && window.location.search.indexOf('page=') === -1) {
			if (components.get('post/anchor', postIndex).length) {
				return navigator.scrollToPostIndex(postIndex, true);
			}
		} else if (bookmark && (!config.usePagination || (config.usePagination && ajaxify.data.pagination.currentPage === 1)) && ajaxify.data.postcount > ajaxify.data.bookmarkThreshold) {
			navigator.update(0);
			app.alert({
				alert_id: 'bookmark',
				message: '[[topic:bookmark_instructions]]',
				timeout: 0,
				type: 'info',
				clickfn : function() {
					navigator.scrollToPost(parseInt(bookmark - 1, 10), true);
				},
				closefn : function() {
					localStorage.removeItem('topic:' + tid + ':bookmark');
				}
			});
			setTimeout(function() {
				app.removeAlert('bookmark');
			}, 10000);
		} else {
			navigator.update(0);
		}
	}

	function getPostIndex() {
		var parts = window.location.pathname.split('/');
		var lastPart = parts[parts.length - 1];
		if (lastPart && utils.isNumber(lastPart)) {
			lastPart = Math.max(0, parseInt(lastPart, 10) - 1);
		} else {
			return 0;
		}

		if (lastPart > 0 && !components.get('post/anchor', lastPart).length) {
			return components.get('post/anchor').last().attr('name');
		}

		return lastPart;
	}

	function addBlockQuoteHandler() {
		components.get('topic').on('click', 'blockquote .toggle', function() {
			var blockQuote = $(this).parent('blockquote');
			var toggle = $(this);
			blockQuote.toggleClass('uncollapsed');
			var collapsed = !blockQuote.hasClass('uncollapsed');
			toggle.toggleClass('fa-angle-down', collapsed).toggleClass('fa-angle-up', !collapsed);
		});
	}

	function addParentHandler() {
		components.get('topic').on('click', '[component="post/parent"]', function() {
			var toPid = $(this).attr('data-topid');

			var toPost = $('[component="post"][data-pid="' + toPid + '"]');
			if (toPost.length) {
				return navigator.scrollToPost(toPost.attr('data-index'), true);
			}

			socket.emit('posts.getPidIndex', {pid: toPid, tid: ajaxify.data.tid, topicPostSort: config.topicPostSort}, function(err, index) {
				if (err) {
					return app.alertError(err.message);
				}

				if (utils.isNumber(index)) {
					navigator.scrollToPost(index, true);
				}
			});
		});
	}

	function enableInfiniteLoadingOrPagination() {
		if (!config.usePagination) {
			infinitescroll.init($('[component="topic"]'), posts.loadMorePosts);
		} else {
			navigator.disable();
		}
	}

	function updateTopicTitle() {
		var span = components.get('navbar/title').find('span');
		if ($(window).scrollTop() > 50 && span.hasClass('hidden')) {
			span.html(ajaxify.data.title).removeClass('hidden');
		} else if ($(window).scrollTop() <= 50 && !span.hasClass('hidden')) {
			span.html('').addClass('hidden');
		}
		if ($(window).scrollTop() > 300) {
			app.removeAlert('bookmark');
		}
	}

	Topic.calculateIndex = function(index, elementCount) {
		if (index !== 1 && config.topicPostSort !== 'oldest_to_newest') {
			return elementCount - index + 2;
		}
		return index;
	};

	Topic.navigatorCallback = function(index, elementCount, threshold) {
		var path = ajaxify.removeRelativePath(window.location.pathname.slice(1));
		if (!path.startsWith('topic')) {
			return 1;
		}

		if (!navigator.scrollActive) {
			var parts = ajaxify.removeRelativePath(window.location.pathname.slice(1)).split('/');
			var topicId = parts[1],
				slug = parts[2];
			var newUrl = 'topic/' + topicId + '/' + (slug ? slug : '');
			if (index > 1) {
				newUrl += '/' + index;
			}

			posts.loadImages(threshold);

			if (newUrl !== currentUrl) {
				if (Topic.replaceURLTimeout) {
					clearTimeout(Topic.replaceURLTimeout);
				}
				Topic.replaceURLTimeout = setTimeout(function() {
					updateUserBookmark(index);

					Topic.replaceURLTimeout = 0;
					if (history.replaceState) {
						var search = (window.location.search ? window.location.search : '');
						history.replaceState({
							url: newUrl + search
						}, null, window.location.protocol + '//' + window.location.host + RELATIVE_PATH + '/' + newUrl + search);
					}
					currentUrl = newUrl;
				}, 500);
			}
		}
	};

	function updateUserBookmark(index) {
		var bookmarkKey = 'topic:' + ajaxify.data.tid + ':bookmark';
		var currentBookmark = ajaxify.data.bookmark || localStorage.getItem(bookmarkKey);

		if (ajaxify.data.postcount > ajaxify.data.bookmarkThreshold && (!currentBookmark || parseInt(index, 10) > parseInt(currentBookmark, 10))) {
			if (app.user.uid) {
				socket.emit('topics.bookmark', {
					'tid': ajaxify.data.tid,
					'index': index
				}, function(err) {
					if (err) {
						return app.alertError(err.message);
					}
					ajaxify.data.bookmark = index;
				});
			} else {
				localStorage.setItem(bookmarkKey, index);
			}
		}

		// removes the bookmark alert when we get to / past the bookmark
		if (!currentBookmark || parseInt(index, 10) >= parseInt(currentBookmark, 10)) {
			app.removeAlert('bookmark');
		}

	}


	return Topic;
});
