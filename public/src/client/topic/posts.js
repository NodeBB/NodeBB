'use strict';

/* globals config, app, ajaxify, define, socket, utils */

define('forum/topic/posts', [
	'forum/pagination',
	'forum/infinitescroll',
	'forum/topic/postTools',
	'navigator',
	'components'
], function(pagination, infinitescroll, postTools, navigator, components) {

	var Posts = {
		_imageLoaderTimeout: undefined
	};

	Posts.onNewPost = function(data) {
		if (!data || !data.posts || !data.posts.length) {
			return;
		}

		if (parseInt(data.posts[0].tid, 10) !== parseInt(ajaxify.data.tid, 10)) {
			return;
		}

		data.loggedIn = app.user.uid ? true : false;
		data.posts.forEach(function(post) {
			post.selfPost = !!app.user.uid && parseInt(post.uid, 10) === parseInt(app.user.uid, 10);
			post.display_moderator_tools = post.selfPost || ajaxify.data.privileges.isAdminOrMod;
			post.display_move_tools = ajaxify.data.privileges.isAdminOrMod;
			post.display_post_menu = ajaxify.data.privileges.isAdminOrMod || post.selfPost || ((app.user.uid || ajaxify.data.postSharing.length) && !post.deleted);
		});

		updatePostCounts(data.posts);
		ajaxify.data.postcount ++;
		postTools.updatePostCount(ajaxify.data.postcount);

		if (config.usePagination) {
			onNewPostPagination(data);
		} else {
			onNewPostInfiniteScroll(data);
		}
	};

	function updatePostCounts(posts) {
		for (var i=0; i<posts.length; ++i) {
			var cmp = components.get('user/postcount', posts[i].uid);
			cmp.html(parseInt(cmp.attr('data-postcount'), 10) + 1);
			utils.addCommasToNumbers(cmp);
		}
	}

	function onNewPostPagination(data) {
		function scrollToPost() {
			scrollToPostIfSelf(data.posts[0]);
		}

		var posts = data.posts;

		ajaxify.data.pagination.pageCount = Math.max(1, Math.ceil((posts[0].topic.postcount - 1) / config.postsPerPage));
		var direction = config.topicPostSort === 'oldest_to_newest' || config.topicPostSort === 'most_votes' ? 1 : -1;

		var isPostVisible = (ajaxify.data.pagination.currentPage === ajaxify.data.pagination.pageCount && direction === 1) || (ajaxify.data.pagination.currentPage === 1 && direction === -1);

		if (isPostVisible) {
			createNewPosts(data, components.get('post').not('[data-index=0]'), direction, scrollToPost);
		} else if (ajaxify.data.scrollToMyPost && parseInt(posts[0].uid, 10) === parseInt(app.user.uid, 10)) {
			pagination.loadPage(ajaxify.data.pagination.pageCount, scrollToPost);
		}
	}

	function onNewPostInfiniteScroll(data) {
		var direction = config.topicPostSort === 'oldest_to_newest' || config.topicPostSort === 'most_votes' ? 1 : -1;

		createNewPosts(data, components.get('post').not('[data-index=0]'), direction, function(html) {
			if (html) {
				html.addClass('new');
			}
			scrollToPostIfSelf(data.posts[0]);
		});
	}

	function scrollToPostIfSelf(post) {
		if (!ajaxify.data.scrollToMyPost) {
		    return;
		}
		var isSelfPost = parseInt(post.uid, 10) === parseInt(app.user.uid, 10);
		if (isSelfPost) {
			navigator.scrollBottom(post.index);
		}
	}

	function createNewPosts(data, repliesSelector, direction, callback) {
		callback = callback || function() {};
		if (!data || (data.posts && !data.posts.length)) {
			return callback();
		}

		function removeAlreadyAddedPosts() {
			var newPosts = $('[component="post"].new');

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

			if (newPosts.length && data.posts.length > 1) {
				data.posts.forEach(function(post) {
					var p = components.get('post', 'pid', post.pid);
					if (p.hasClass('new')) {
						p.remove();
					}
				});
			}

			data.posts = data.posts.filter(function(post) {
				return $('[component="post"][data-pid="' + post.pid + '"]').length === 0;
			});
		}

		removeAlreadyAddedPosts();

		if (!data.posts.length) {
			return callback();
		}

		var after, before;

		if (direction > 0 && repliesSelector.length) {
			after = repliesSelector.last();
		} else if (direction < 0 && repliesSelector.length) {
			before = repliesSelector.first();
		}

		data.slug = ajaxify.data.slug;

		$(window).trigger('action:posts.loading', {posts: data.posts, after: after, before: before});

		app.parseAndTranslate('topic', 'posts', data, function(html) {

			html = html.filter(function() {
				var pid = $(this).attr('data-pid');
				return pid && $('[component="post"][data-pid="' + pid + '"]').length === 0;
			});

			if (after) {
				html.insertAfter(after);
			} else if (before) {
				// Save document height and position for future reference (about 5 lines down)
				var height = $(document).height(),
					scrollTop = $(window).scrollTop();

				html.insertBefore(before);

				// Now restore the relative position the user was on prior to new post insertion
				$(window).scrollTop(scrollTop + ($(document).height() - height));
			} else {
				components.get('topic').append(html);
			}

			infinitescroll.removeExtra($('[component="post"]'), direction, 40);

			$(window).trigger('action:posts.loaded', {posts: data.posts});

			Posts.processPage(html);

			callback(html);
		});
	}

	Posts.loadMorePosts = function(direction) {
		if (!components.get('topic').length || navigator.scrollActive || Posts._infiniteScrollTimeout) {
			return;
		}

		Posts._infiniteScrollTimeout = setTimeout(function() {
			delete Posts._infiniteScrollTimeout;
		}, 1000);
		var replies = components.get('post').not('[data-index=0]').not('.new');
		var afterEl = direction > 0 ? replies.last() : replies.first();
		var after = parseInt(afterEl.attr('data-index'), 10) || 0;

		var tid = ajaxify.data.tid;
		if (!utils.isNumber(tid) || !utils.isNumber(after) || (direction < 0 && components.get('post', 'index', 0).length)) {
			return;
		}

		var indicatorEl = $('.loading-indicator');
		if (!indicatorEl.is(':animated')) {
			indicatorEl.fadeIn();
		}

		infinitescroll.loadMore('topics.loadMore', {
			tid: tid,
			after: after,
			direction: direction
		}, function (data, done) {
			indicatorEl.fadeOut();

			if (data && data.posts && data.posts.length) {
				createNewPosts(data, replies, direction, done);
			} else {
				if (app.user.uid) {
					socket.emit('topics.markAsRead', [tid]);
				}
				navigator.update();
				done();
			}
		});
	};

	Posts.processPage = function(posts) {
		Posts.unloadImages(posts);
		Posts.showBottomPostBar();
		posts.find('[component="post/content"] img:not(.not-responsive)').addClass('img-responsive');
		app.createUserTooltips(posts);
		app.replaceSelfLinks(posts.find('a'));
		utils.addCommasToNumbers(posts.find('.formatted-number'));
		utils.makeNumbersHumanReadable(posts.find('.human-readable-number'));
		posts.find('.timeago').timeago();

		addBlockquoteEllipses(posts.find('[component="post/content"] > blockquote > blockquote'));
		hidePostToolsForDeletedPosts(posts);
	};

	Posts.unloadImages = function(posts) {
		var images = posts.find('[component="post/content"] img:not(.not-responsive)');

		if (config.delayImageLoading) {
			images.each(function() {
				$(this).attr('data-src', $(this).attr('src'));
			}).attr('data-state', 'unloaded').attr('src', 'about:blank');
		} else {
			images.attr('data-state', 'loaded');
			Posts.wrapImagesInLinks(posts);
		}
	};

	Posts.loadImages = function(threshold) {
		if (Posts._imageLoaderTimeout) {
			clearTimeout(Posts._imageLoaderTimeout);
		}

		Posts._imageLoaderTimeout = setTimeout(function() {
			/*
				If threshold is defined, images loaded above this threshold will modify
				the user's scroll position so they are not scrolled away from content
				they were reading. Images loaded below this threshold will push down content.

				If no threshold is defined, loaded images will push down content, as per
				default
			*/

			var images = components.get('post/content').find('img[data-state="unloaded"]'),
				visible = images.filter(function() {
					return utils.isElementInViewport(this);
				}),
				posts = $.unique(visible.map(function() {
					return $(this).parents('[component="post"]').get(0);
				})),
				scrollTop = $(window).scrollTop(),
				adjusting = false,
				adjustQueue = [],
				adjustPosition = function() {
					adjusting = true;
					oldHeight = document.body.clientHeight;

					// Display the image
					$(this).attr('data-state', 'loaded');
					newHeight = document.body.clientHeight;

					var imageRect = this.getBoundingClientRect();
					if (imageRect.top < threshold) {
						scrollTop = scrollTop + (newHeight - oldHeight);
						$(window).scrollTop(scrollTop);
					}

					if (adjustQueue.length) {
						adjustQueue.pop()();
					} else {
						adjusting = false;

						Posts.wrapImagesInLinks(posts);
						posts.length = 0;
					}
				},
				oldHeight, newHeight;

			// For each image, reset the source and adjust scrollTop when loaded
			visible.attr('data-state', 'loading');
			visible.each(function(index, image) {
				image = $(image);

				image.on('load', function() {
					if (!adjusting) {
						adjustPosition.call(this);
					} else {
						adjustQueue.push(adjustPosition.bind(this));
					}
				});

				image.attr('src', image.attr('data-src'));
				image.removeAttr('data-src');
			});
		}, 250);
	};

	Posts.wrapImagesInLinks = function(posts) {
		posts.find('[component="post/content"] img:not(.emoji)').each(function() {
			var $this = $(this),
				src = $this.attr('src'),
				suffixRegex = /-resized(\.[\w]+)?$/;

			if (utils.isRelativeUrl(src) && suffixRegex.test(src)) {
				src = src.replace(suffixRegex, '$1');
			}

			if (!$this.parent().is('a')) {
				$this.wrap('<a href="' + src + '" target="_blank">');
			}
		});
	};

	Posts.showBottomPostBar = function() {
		var mainPost = components.get('post', 'index', 0);
		var posts = $('[component="post"]');
		if (!!mainPost.length && posts.length > 1 && $('.post-bar').length < 2) {
			$('.post-bar').clone().appendTo(mainPost);
		} else if (mainPost.length && posts.length < 2) {
			mainPost.find('.post-bar').remove();
		}
	};

	function hidePostToolsForDeletedPosts(posts) {
		posts.each(function() {
			if ($(this).hasClass('deleted')) {
				postTools.toggle($(this).attr('data-pid'), true);
			}
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
