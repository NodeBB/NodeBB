
'use strict';

/* globals config, app, ajaxify, define, socket, utils */

define('forum/topic/posts', [
	'forum/pagination',
	'forum/infinitescroll',
	'forum/topic/postTools',
	'navigator'
], function(pagination, infinitescroll, postTools, navigator) {

	var Posts = {};

	Posts.onNewPost = function(data) {
		var tid = ajaxify.variables.get('topic_id');
		if(data && data.posts && data.posts.length && parseInt(data.posts[0].tid, 10) !== parseInt(tid, 10)) {
			return;
		}

		if(config.usePagination) {
			return onNewPostPagination(data);
		}

		for (var i=0; i<data.posts.length; ++i) {
			var postcount = $('.user_postcount_' + data.posts[i].uid);
			postcount.html(parseInt(postcount.html(), 10) + 1);
		}

		createNewPosts(data);
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
			var firstPostIndex = parseInt(data.posts[0].index, 10);

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
					if (firstPostIndex > parseInt(firstReply.attr('data-index'), 10)) {
						before = firstReply;
					} else if(firstPostIndex <= parseInt(firstReply.attr('data-index'), 10)) {
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

		if (app.uid) {
			socket.emit('posts.getPrivileges', pids, function(err, privileges) {
				if(err) {
					return app.alertError(err.message);
				}

				for(i=0; i<pids.length; ++i) {
					toggleModTools(pids[i], privileges[i]);
				}
			});
		} else {
			for(i=0; i<pids.length; ++i) {
				toggleModTools(pids[i], {editable:false, move: false});
			}
		}

		Posts.processPage(html);
	}

	function toggleModTools(pid, privileges) {
		var postEl = $('.post-row[data-pid="' + pid + '"]');

		if (!privileges.editable) {
			postEl.find('.edit, .delete, .purge').remove();
		}
		if (!privileges.move) {
			postEl.find('.move').remove();
		}
		postEl.find('.reply, .quote').toggleClass('hidden', !$('.post_reply').length);
		var isSelfPost = parseInt(postEl.attr('data-uid'), 10) === parseInt(app.uid, 10);
		postEl.find('.chat, .flag').toggleClass('hidden', isSelfPost || !app.uid);
	}

	Posts.loadMorePosts = function(direction) {
		if (!$('#post-container').length || navigator.scrollActive) {
			return;
		}

		var reverse = config.topicPostSort === 'newest_to_oldest' || config.topicPostSort === 'most_votes';

		infinitescroll.calculateAfter(direction, '#post-container .post-row[data-index!="0"]', config.postsPerPage, reverse, function(after, offset, el) {
			loadPostsAfter(after);
		});
	};

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
			} else {
				if (app.uid) {
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
		element.find('span.timeago').timeago();
		element.find('.post-content img:not(.emoji)').addClass('img-responsive').each(function() {
			var $this = $(this);
			if (!$this.parent().is('a')) {
				$this.wrap('<a href="' + $this.attr('src') + '" target="_blank">');
			}
		});
		postTools.updatePostCount();
		addBlockquoteEllipses(element.find('.post-content > blockquote'));
		hidePostToolsForDeletedPosts(element);
		showBottomPostBar();
	};

	function showBottomPostBar() {
		if($('#post-container .post-row').length > 1 || !$('#post-container li[data-index="0"]').length) {
			$('.bottom-post-bar').removeClass('hide');
		}
	}

	function hidePostToolsForDeletedPosts(element) {
		element.find('li.deleted').each(function() {
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
