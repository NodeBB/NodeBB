'use strict';

/* globals config, app, ajaxify, components, define, socket, utils */

define('forum/topic/posts', [
	'forum/pagination',
	'forum/infinitescroll',
	'forum/topic/postTools',
	'navigator'
], function(pagination, infinitescroll, postTools, navigator) {

	var Posts = {};

	Posts.onNewPost = function(data) {
		var tid = ajaxify.variables.get('topic_id');
		if (data && data.posts && data.posts.length && parseInt(data.posts[0].tid, 10) !== parseInt(tid, 10)) {
			return;
		}

		if (config.usePagination) {
			return onNewPostPagination(data);
		}

		for (var i=0; i<data.posts.length; ++i) {
			var postcount = components.get('user/postcount', data.posts[i].uid);
			postcount.html(parseInt(postcount.html(), 10) + 1);
		}

		createNewPosts(data, components.get('post').not('[data-index=0]'), function(html) {
			if (html) {
				html.addClass('new');
			}
		});
	};

	function onNewPostPagination(data) {
		function scrollToPost() {
			navigator.scrollBottom(data.posts[0].index);
		}

		var posts = data.posts;

		pagination.pageCount = Math.max(1, Math.ceil((posts[0].topic.postcount - 1) / config.postsPerPage));

		if (pagination.currentPage === pagination.pageCount) {
			createNewPosts(data, components.get('post').not('[data-index=0]'), scrollToPost);
		} else if (parseInt(posts[0].uid, 10) === parseInt(app.user.uid, 10)) {
			pagination.loadPage(pagination.pageCount, scrollToPost);
		}
	}

	function createNewPosts(data, repliesSelector, callback) {
		callback = callback || function() {};
		if(!data || (data.posts && !data.posts.length)) {
			return callback();
		}

		function removeAlreadyAddedPosts() {
			var newPosts = components.get('topic').find('[data-index][data-index!="0"].new');

			if (newPosts.length === data.posts.length) {
				var allSamePids = true;
				newPosts.each(function(index, el) {
					if (parseInt($(el).attr('data-pid'), 10) !== parseInt(data.posts[index].pid, 10)) {
						allSamePids = false;
					}
				});

				if (allSamePids) {
					newPosts.each(function() {
						$(this).removeClass('new');
					});
					data.posts.length = 0;
					return;
				}
			}

			if (data.posts.length > 1) {
				data.posts.forEach(function(post) {
					components.get('post', 'pid', post.pid).remove();
				});
			} else {
				data.posts = data.posts.filter(function(post) {
					return components.get('post', 'pid', post.pid).length === 0;
				});
			}
		}

		var after = null,
			before = null;

		function findInsertionPoint() {
			var firstPostTimestamp = parseInt(data.posts[0].timestamp, 10);
			var firstPostVotes = parseInt(data.posts[0].votes, 10);
			var firstPostIndex = parseInt(data.posts[0].index, 10);
			var replies = $(repliesSelector);
			var firstReply = replies.first();
			var lastReply = replies.last();

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
					if (firstPostIndex > parseInt(firstReply.attr('data-index'), 10)) {
						before = firstReply;
					} else if(firstPostIndex <= parseInt(firstReply.attr('data-index'), 10)) {
						after = lastReply;
					}
				}
			}
		}

		removeAlreadyAddedPosts();
		if (!data.posts.length) {
			return callback();
		}

		findInsertionPoint();

		data.title = $('<div></div>').text(ajaxify.variables.get('topic_name')).html();
		data.viewcount = ajaxify.variables.get('viewcount');

		infinitescroll.parseAndTranslate('topic', 'posts', data, function(html) {
			if (after) {
				html.insertAfter(after);
			} else if (before) {
				// Save document height and position for future reference (about 5 lines down)
				var height = $(document).height(),
					scrollTop = $(document).scrollTop(),
					originalPostEl = components.get('post', 'index', 0);

				// Insert the new post
				html.insertBefore(before);

				// If the user is not at the top of the page... (or reasonably so...)
				if (scrollTop > originalPostEl.offset().top) {
					// Now restore the relative position the user was on prior to new post insertion
					$(document).scrollTop(scrollTop + ($(document).height() - height));
				}
			} else {
				components.get('topic').append(html);
			}

			html.hide().fadeIn('slow');

			var pids = [];
			for(var i=0; i<data.posts.length; ++i) {
				pids.push(data.posts[i].pid);
			}

			$(window).trigger('action:posts.loaded', {posts: data.posts});
			onNewPostsLoaded(html, pids);
			callback(html);
		});
	}

	function onNewPostsLoaded(html, pids) {
		if (app.user.uid) {
			socket.emit('posts.getPrivileges', pids, function(err, privileges) {
				if(err) {
					return app.alertError(err.message);
				}

				for(var i=0; i<pids.length; ++i) {
					toggleModTools(pids[i], privileges[i]);
				}
			});
		} else {
			for(var i=0; i<pids.length; ++i) {
				toggleModTools(pids[i], {editable: false, move: false});
			}
		}

		Posts.processPage(html);
	}

	function toggleModTools(pid, privileges) {
		var postEl = components.get('post', 'pid', pid),
			isSelfPost = parseInt(postEl.attr('data-uid'), 10) === parseInt(app.user.uid, 10);

		if (!privileges.editable) {
			postEl.find('[component="post/edit"], [component="post/delete"], [component="post/purge"]').remove();
		}

		if (!privileges.move) {
			postEl.find('[component="post/move"]').remove();
		}

		postEl.find('[component="user/chat"], [component="post/flag"]').toggleClass('hidden', isSelfPost || !app.user.uid);
	}

	Posts.loadMorePosts = function(direction) {
		if (!components.get('topic').length || navigator.scrollActive) {
			return;
		}

		var reverse = config.topicPostSort === 'newest_to_oldest' || config.topicPostSort === 'most_votes';

		infinitescroll.calculateAfter(direction, components.get('topic').find('[data-index][data-index!="0"]:not(.new)'), config.postsPerPage, reverse, function(after, offset, el) {
			loadPostsAfter(after);
		});
	};

	function loadPostsAfter(after) {
		var tid = ajaxify.variables.get('topic_id');
		if (!utils.isNumber(tid) || !utils.isNumber(after) || (after === 0 && components.get('post', 'index', 1).length)) {
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
				createNewPosts(data, components.get('post').not('[data-index=0]').not('.new'), done);
			} else {
				if (app.user.uid) {
					socket.emit('topics.markAsRead', [tid]);
				}
				navigator.update();
				done();
			}
		});
	}

	Posts.processPage = function(element) {
		app.createUserTooltips();
		app.replaceSelfLinks(element.find('a'));
		utils.addCommasToNumbers(element.find('.formatted-number'));
		utils.makeNumbersHumanReadable(element.find('.human-readable-number'));
		element.find('.timeago').timeago();
		element.find('[component="post/content"] img:not(.emoji)').addClass('img-responsive').each(function() {
			var $this = $(this);
			if (!$this.parent().is('a')) {
				$this.wrap('<a href="' + $this.attr('src') + '" target="_blank">');
			}
		});
		postTools.updatePostCount();
		addBlockquoteEllipses(element.find('[component="post/content"] > blockquote'));
		hidePostToolsForDeletedPosts(element);
		showBottomPostBar();
	};

	function showBottomPostBar() {
		if(components.get('post').length > 1 || !components.get('post', 'index', 0).length) {
			$('.bottom-post-bar').removeClass('hide');
		}
	}

	function hidePostToolsForDeletedPosts(element) {
		element.find('[data-pid].deleted').each(function() {
			postTools.toggle($(this).attr('data-pid'), true);
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

	return Posts;

});