'use strict';


/* globals define, app, templates, socket, bootbox, config, ajaxify, RELATIVE_PATH, utils */

define('forum/topic', [
	'forum/pagination',
	'forum/infinitescroll',
	'forum/topic/threadTools',
	'forum/topic/postTools',
	'forum/topic/events',
	'forum/topic/browsing',
	'forum/topic/posts',
	'navigator',
	'sort',
	'components',
	'translator'
], function(pagination, infinitescroll, threadTools, postTools, events, browsing, posts, navigator, sort, components, translator) {
	var	Topic = {},
		currentUrl = '';

	$(window).on('action:ajaxify.start', function(ev, data) {
		if (ajaxify.currentPage !== data.url) {
			navigator.hide();
			components.get('navbar/title').find('span').text('').hide();
			app.removeAlert('bookmark');

			events.removeListeners();
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

		handleBookmark(tid);

		navigator.init('[component="post"]', ajaxify.data.postcount, Topic.toTop, Topic.toBottom, Topic.navigatorCallback, Topic.calculateIndex);

		$(window).on('scroll', updateTopicTitle);

		$(window).trigger('action:topic.loaded');

		if (app.user.uid) {
			socket.emit('topics.enter', tid, function(err, data) {
				if (err) {
					return app.alertError(err.message);
				}
				browsing.onUpdateUsersInRoom(data);
			});
		}

		handleTopicSearch();
	};

	function handleTopicSearch() {
		require(['search', 'mousetrap'], function(search, Mousetrap) {
			$('.topic-search')
				.on('click', '.prev', function() {
					search.topicDOM.prev();
				})
				.on('click', '.next', function() {
					search.topicDOM.next();
				});

			Mousetrap.bind('ctrl+f', function(e) {
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
				return navigator.scrollToPostIndex(postIndex - 1, true);
			}
		} else if (bookmark && (!config.usePagination || (config.usePagination && pagination.currentPage === 1)) && ajaxify.data.postcount > 1) {
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
		}
	}

	function getPostIndex() {
		var parts = window.location.pathname.split('/');
		var lastPart = parts[parts.length - 1];
		if (lastPart && utils.isNumber(lastPart)) {
			lastPart = parseInt(lastPart, 10);
		} else {
			return 0;
		}

		while (lastPart > 0 && !components.get('post/anchor', lastPart).length) {
			lastPart --;
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


	function enableInfiniteLoadingOrPagination() {
		if(!config.usePagination) {
			infinitescroll.init(posts.loadMorePosts, components.get('post', 'index', 0).height());
		} else {
			navigator.hide();

			pagination.init(parseInt(ajaxify.data.currentPage, 10), parseInt(ajaxify.data.pageCount, 10));
		}
	}


	function updateTopicTitle() {
		if($(window).scrollTop() > 50) {
			components.get('navbar/title').find('span').text(ajaxify.data.title).show();
		} else {
			components.get('navbar/title').find('span').text('').hide();
		}
	}

	Topic.calculateIndex = function(index, elementCount) {
		if (index !== 1 && config.topicPostSort !== 'oldest_to_newest') {
			return elementCount - index + 2;
		}
		return index;
	};

	Topic.navigatorCallback = function(topPostIndex, bottomPostIndex, elementCount) {
		var path = ajaxify.removeRelativePath(window.location.pathname.slice(1));
		if (!path.startsWith('topic')) {
			return 1;
		}
		var postIndex = topPostIndex;
		var index = bottomPostIndex;
		if (config.topicPostSort !== 'oldest_to_newest') {
			if (bottomPostIndex === 0) {
				index = 1;
			} else  {
				index = Math.max(elementCount - bottomPostIndex + 2, 1);
			}
		}

		var bookmarkKey = 'topic:' + ajaxify.data.tid + ':bookmark';
		var currentBookmark = ajaxify.data.bookmark || localStorage.getItem(bookmarkKey);

		if (!currentBookmark || parseInt(postIndex, 10) > parseInt(currentBookmark, 10)) {
			if (app.user.uid) {
				var payload = {
					'tid': ajaxify.data.tid,
					'index': postIndex
				};
				socket.emit('topics.bookmark', payload, function(err) {
					if (err) {
						console.warn('Error saving bookmark:', err);
					}
					ajaxify.data.bookmark = postIndex;
				});
			} else {
				localStorage.setItem(bookmarkKey, postIndex);
			}
		}

		// removes the bookmark alert when we get to / past the bookmark
		if (!currentBookmark || parseInt(postIndex, 10) >= parseInt(currentBookmark, 10)) {
			app.removeAlert('bookmark');
		}

		if (!navigator.scrollActive) {
			var parts = ajaxify.removeRelativePath(window.location.pathname.slice(1)).split('/');
			var topicId = parts[1],
				slug = parts[2];
			var newUrl = 'topic/' + topicId + '/' + (slug ? slug : '');
			if (postIndex > 1) {
				newUrl += '/' + postIndex;
			}

			if (newUrl !== currentUrl) {
				if (history.replaceState) {
					var search = (window.location.search ? window.location.search : '');
					history.replaceState({
						url: newUrl + search
					}, null, window.location.protocol + '//' + window.location.host + RELATIVE_PATH + '/' + newUrl + search);
				}
				currentUrl = newUrl;
			}
		}
		return index;
	};


	return Topic;
});
