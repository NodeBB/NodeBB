'use strict';


/* globals define, app, templates, translator, socket, bootbox, config, ajaxify, RELATIVE_PATH, utils */

var dependencies = [
	'forum/pagination',
	'forum/infinitescroll',
	'forum/topic/threadTools',
	'forum/topic/postTools',
	'forum/topic/events',
	'forum/topic/browsing',
	'navigator'
];

define('forum/topic', dependencies, function(pagination, infinitescroll, threadTools, postTools, events, browsing, navigator) {
	var	Topic = {},
		currentUrl = '';

	$(window).on('action:ajaxify.start', function(ev, data) {
		if(data.url.indexOf('topic') !== 0) {
			navigator.hide();
			$('.header-topic-title').find('span').text('').hide();
			app.removeAlert('bookmark');

			events.removeListeners();

			socket.removeListener('event:new_post', onNewPost);
			socket.removeListener('event:new_notification', onNewNotification);
		}
	});

	Topic.init = function() {
		var tid = ajaxify.variables.get('topic_id'),
			thread_state = {
				locked: ajaxify.variables.get('locked'),
				deleted: ajaxify.variables.get('deleted'),
				pinned: ajaxify.variables.get('pinned')
			},
			postCount = ajaxify.variables.get('postcount');

		$(window).trigger('action:topic.loading');

		app.enterRoom('topic_' + tid);

		processPage($('.topic'));

		showBottomPostBar();

		postTools.init(tid, thread_state);
		threadTools.init(tid, thread_state);
		events.init();

		handleSorting();

		hidePostToolsForDeletedPosts();

		enableInfiniteLoadingOrPagination();

		addBlockQuoteHandler();

		addBlockquoteEllipses($('.topic .post-content > blockquote'));

		handleBookmark(tid);

		navigator.init('.posts > .post-row', postCount, Topic.toTop, Topic.toBottom, Topic.navigatorCallback, Topic.calculateIndex);

		socket.on('event:new_post', onNewPost);
		socket.on('event:new_notification', onNewNotification);

		$(window).on('scroll', updateTopicTitle);

		$(window).trigger('action:topic.loaded');

		socket.emit('topics.enter', tid);
	};

	Topic.toTop = function() {
		navigator.scrollTop(0);
	};

	Topic.toBottom = function() {
		socket.emit('topics.postcount', ajaxify.variables.get('topic_id'), function(err, postCount) {
			if (config.topicPostSort !== 'oldest_to_newest') {
				postCount = 1;
			}
			navigator.scrollBottom(postCount);
		});
	};

	function handleBookmark(tid) {
		var bookmark = localStorage.getItem('topic:' + tid + ':bookmark');
		var postIndex = getPostIndex();
		if (postIndex) {
			navigator.scrollToPost(postIndex - 1, true);
		} else if (bookmark && (!config.usePagination || (config.usePagination && pagination.currentPage === 1)) && ajaxify.variables.get('postcount') > 1) {
			app.alert({
				alert_id: 'bookmark',
				message: '[[topic:bookmark_instructions]]',
				timeout: 0,
				type: 'info',
				clickfn : function() {
					navigator.scrollToPost(parseInt(bookmark, 10), true);
				},
				closefn : function() {
					localStorage.removeItem('topic:' + tid + ':bookmark');
				}
			});
		}
	}

	function getPostIndex() {
		var parts = window.location.pathname.split('/');
		return parts[4] ? parseInt(parts[4], 10) : 0;
	}

	function handleSorting() {
		var threadSort = $('.thread-sort');
		threadSort.find('i').removeClass('fa-check');
		var currentSetting = threadSort.find('a[data-sort="' + config.topicPostSort + '"]');
		currentSetting.find('i').addClass('fa-check');

		$('.thread-sort').on('click', 'a', function() {
			var newSetting = $(this).attr('data-sort');
			socket.emit('user.setTopicSort', newSetting, function(err) {
				config.topicPostSort = newSetting;
				ajaxify.go('topic/' + ajaxify.variables.get('topic_slug'));
			});
		});
	}

	function showBottomPostBar() {
		if($('#post-container .post-row').length > 1 || !$('#post-container li[data-index="0"]').length) {
			$('.bottom-post-bar').removeClass('hide');
		}
	}

	function onNewPost(data) {
		var tid = ajaxify.variables.get('topic_id');
		if(data && data.posts && data.posts.length && data.posts[0].tid !== tid) {
			return;
		}

		if(config.usePagination) {
			return onNewPostPagination(data);
		}

		for (var i=0; i<data.posts.length; ++i) {
			var postcount = $('.user_postcount_' + data.posts[i].uid);
			postcount.html(parseInt(postcount.html(), 10) + 1);
		}
		socket.emit('topics.markAsRead', [tid]);
		createNewPosts(data);
	}

	function onNewNotification(data) {
		var tid = ajaxify.variables.get('topic_id');
		if (data && data.tid && parseInt(data.tid, 10) === parseInt(tid, 10)) {
			socket.emit('topics.markTopicNotificationsRead', tid);
		}
	}

	function addBlockQuoteHandler() {
		$('#post-container').on('click', 'blockquote .toggle', function() {
			var blockQuote = $(this).parent('blockquote');
			var toggle = $(this);
			blockQuote.toggleClass('uncollapsed');
			var collapsed = !blockQuote.hasClass('uncollapsed');
			toggle.toggleClass('fa-angle-down', collapsed).toggleClass('fa-angle-up', !collapsed);
		});
	}

	function addBlockquoteEllipses(blockquotes) {
		blockquotes.each(function() {
			var $this = $(this);
			if ($this.find(':hidden:not(br)').length && !$this.find('.toggle').length) {
				$this.append('<i class="fa fa-angle-down pointer toggle"></i>');
			}
		});
	}

	function enableInfiniteLoadingOrPagination() {
		if(!config.usePagination) {
			infinitescroll.init(loadMorePosts, $('#post-container .post-row[data-index="0"]').height());
		} else {
			navigator.hide();

			pagination.init(parseInt(ajaxify.variables.get('currentPage'), 10), parseInt(ajaxify.variables.get('pageCount'), 10));
		}
	}

	function hidePostToolsForDeletedPosts() {
		$('#post-container li.deleted').each(function() {
			postTools.toggle($(this).attr('data-pid'), true);
		});
	}


	function updateTopicTitle() {
		if($(window).scrollTop() > 50) {
			$('.header-topic-title').find('span').text(ajaxify.variables.get('topic_name')).show();
		} else {
			$('.header-topic-title').find('span').text('').hide();
		}
	}

	Topic.calculateIndex = function(index, elementCount) {
		if (index !== 1 && config.topicPostSort !== 'oldest_to_newest') {
			return elementCount - index + 2;
		}
		return index;
	};

	Topic.navigatorCallback = function(element, elementCount) {
		var path = ajaxify.removeRelativePath(window.location.pathname.slice(1));
		if (!path.startsWith('topic')) {
			return 1;
		}
		var postIndex = parseInt(element.attr('data-index'), 10);
		var index = postIndex + 1;
		if (config.topicPostSort !== 'oldest_to_newest') {
			if (postIndex === 0) {
				index = 1;
			} else  {
				index = Math.max(elementCount - postIndex + 1, 1);
			}
		}

		var currentBookmark = localStorage.getItem('topic:' + ajaxify.variables.get('topic_id') + ':bookmark');

		if (!currentBookmark || parseInt(postIndex, 10) >= parseInt(currentBookmark, 10)) {
			localStorage.setItem('topic:' + ajaxify.variables.get('topic_id') + ':bookmark', postIndex);
			app.removeAlert('bookmark');
		}

		if (!navigator.scrollActive) {
			var parts = ajaxify.removeRelativePath(window.location.pathname.slice(1)).split('/');
			var topicId = parts[1],
				slug = parts[2];
			var newUrl = 'topic/' + topicId + '/' + (slug ? slug : '');
			if (postIndex > 0) {
				 newUrl += '/' + (postIndex + 1);
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

	function onNewPostPagination(data) {
		var posts = data.posts;
		socket.emit('topics.getPageCount', ajaxify.variables.get('topic_id'), function(err, newPageCount) {

			pagination.recreatePaginationLinks(newPageCount);

			if (pagination.currentPage === pagination.pageCount) {
				createNewPosts(data);
			} else if(data.posts && data.posts.length && parseInt(data.posts[0].uid, 10) === parseInt(app.uid, 10)) {
				pagination.loadPage(pagination.pageCount);
			}
		});
	}

	function createNewPosts(data, callback) {
		callback = callback || function() {};
		if(!data || (data.posts && !data.posts.length)) {
			return callback(false);
		}

		function removeAlreadyAddedPosts() {
			data.posts = data.posts.filter(function(post) {
				return $('#post-container li[data-pid="' + post.pid +'"]').length === 0;
			});
		}

		var after = null,
			before = null;

		function findInsertionPoint() {
			var firstPostTimestamp = parseInt(data.posts[0].timestamp, 10);
			var firstPostVotes = parseInt(data.posts[0].votes, 10);
			var firstPostPid = data.posts[0].pid;

			var firstReply = $('#post-container li.post-row[data-index!="0"]').first();
			var lastReply = $('#post-container li.post-row[data-index!="0"]').last();

			if (config.topicPostSort === 'oldest_to_newest') {
				if (firstPostTimestamp < parseInt(firstReply.attr('data-timestamp'), 10)) {
					before = firstReply;
				} else if(firstPostTimestamp >= parseInt(lastReply.attr('data-timestamp'), 10)) {
					after = lastReply;
				}
			} else if(config.topicPostSort === 'newest_to_oldest') {
				if (firstPostTimestamp > parseInt(firstReply.attr('data-timestamp'), 10)) {
					before = firstReply;
				} else if(firstPostTimestamp <= parseInt(lastReply.attr('data-timestamp'), 10)) {
					after = lastReply;
				}
			} else if(config.topicPostSort === 'most_votes') {
				if (firstPostVotes > parseInt(firstReply.attr('data-votes'), 10)) {
					before = firstReply;
				} else if(firstPostVotes < parseInt(firstReply.attr('data-votes'), 10)) {
					after = lastReply;
				} else {
					if (firstPostPid > firstReply.attr('data-pid')) {
						before = firstReply;
					} else if(firstPostPid <= firstReply.attr('data-pid')) {
						after = lastReply;
					}
				}
			}
		}

		removeAlreadyAddedPosts();
		if(!data.posts.length) {
			return callback(false);
		}

		findInsertionPoint();

		data.title = $('<div></div>').text(ajaxify.variables.get('topic_name')).html();
		data.viewcount = ajaxify.variables.get('viewcount');

		infinitescroll.parseAndTranslate('topic', 'posts', data, function(html) {
			if(after) {
				html.insertAfter(after);
			} else if(before) {
				// Save document height and position for future reference (about 5 lines down)
				var height = $(document).height(),
					scrollTop = $(document).scrollTop(),
					originalPostEl = $('li[data-index="0"]');

				// Insert the new post
				html.insertBefore(before);

				// If the user is not at the top of the page... (or reasonably so...)
				if (scrollTop > originalPostEl.offset().top) {
					// Now restore the relative position the user was on prior to new post insertion
					$(document).scrollTop(scrollTop + ($(document).height() - height));
				}
			} else {
				$('#post-container').append(html);
			}

			html.hide().fadeIn('slow');

			addBlockquoteEllipses(html.find('.post-content > blockquote'));

			$(window).trigger('action:posts.loaded');
			onNewPostsLoaded(html, data.posts);
			callback(true);
		});
	}

	function onNewPostsLoaded(html, posts) {

		var pids = [];
		for(var i=0; i<posts.length; ++i) {
			pids.push(posts[i].pid);
		}

		socket.emit('posts.getPrivileges', pids, function(err, privileges) {
			if(err) {
				return app.alertError(err.message);
			}

			for(i=0; i<pids.length; ++i) {
				toggleModTools(pids[i], privileges[i]);
			}
		});

		processPage(html);
	}

	function processPage(element) {
		app.createUserTooltips();
		app.replaceSelfLinks(element.find('a'));
		utils.addCommasToNumbers(element.find('.formatted-number'));
		utils.makeNumbersHumanReadable(element.find('.human-readable-number'));
		element.find('span.timeago').timeago();
		element.find('.post-content img:not(.emoji)').addClass('img-responsive').each(function() {
			var $this = $(this);
			if (!$this.parent().is('a')) {
				$this.wrap('<a href="' + $this.attr('src') + '" target="_blank">');
			}
		});
		postTools.updatePostCount();
		showBottomPostBar();
	}

	function toggleModTools(pid, privileges) {
		var postEl = $('.post-row[data-pid="' + pid + '"]');

		postEl.find('.edit, .delete').toggleClass('hidden', !privileges.editable);
		postEl.find('.move').toggleClass('hidden', !privileges.move);
		postEl.find('.reply, .quote').toggleClass('hidden', !$('.post_reply').length);
		var isSelfPost = parseInt(postEl.attr('data-uid'), 10) === parseInt(app.uid, 10);
		postEl.find('.chat, .flag').toggleClass('hidden', isSelfPost || !app.uid);
	}

	function loadMorePosts(direction) {
		if (!$('#post-container').length || navigator.scrollActive) {
			return;
		}

		var reverse = config.topicPostSort === 'newest_to_oldest' || config.topicPostSort === 'most_votes';

		infinitescroll.calculateAfter(direction, '#post-container .post-row[data-index!="0"]', config.postsPerPage, reverse, function(after, offset, el) {
			loadPostsAfter(after);
		});
	}

	function loadPostsAfter(after) {
		var tid = ajaxify.variables.get('topic_id');
		if (!utils.isNumber(tid) || !utils.isNumber(after) || (after === 0 && $('#post-container li.post-row[data-index="1"]').length)) {
			return;
		}

		var indicatorEl = $('.loading-indicator');
		if (!indicatorEl.is(':animated')) {
			indicatorEl.fadeIn();
		}

		infinitescroll.loadMore('topics.loadMore', {
			tid: tid,
			after: after
		}, function (data, done) {

			indicatorEl.fadeOut();

			if (data && data.posts && data.posts.length) {
				createNewPosts(data, function(postsCreated) {
					done();
				});
				hidePostToolsForDeletedPosts();
			} else {
				navigator.update();
				done();
			}
		});
	}

	return Topic;
});
