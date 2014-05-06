'use strict';


/* globals define, app, templates, translator, socket, bootbox, config, ajaxify, RELATIVE_PATH, utils */

define(['forum/pagination', 'forum/topic/threadTools', 'forum/topic/postTools', 'forum/topic/events', 'navigator'], function(pagination, threadTools, postTools, events, navigator) {
	var	Topic = {},
		infiniteLoaderActive = false,
		scrollingToPost = false,
		currentUrl = '';


	$(window).on('action:ajaxify.start', function(ev, data) {
		if(data.url.indexOf('topic') !== 0) {
			navigator.hide();
			$('.header-topic-title').find('span').text('').hide();
			app.removeAlert('bookmark');

			events.removeListeners();

			socket.removeListener('event:new_post', onNewPost);
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

		utils.addCommasToNumbers($('.topic .formatted-number'));

		app.enterRoom('topic_' + tid);

		showBottomPostBar();

		postTools.init(tid, thread_state);
		threadTools.init(tid, thread_state);
		events.init();

		hidePostToolsForDeletedPosts();

		enableInfiniteLoading();

		addBlockquoteEllipses($('.topic .post-content > blockquote'));

		var bookmark = localStorage.getItem('topic:' + tid + ':bookmark');
		if (window.location.hash) {
			Topic.scrollToPost(window.location.hash.substr(1), true);
		} else if (bookmark && (!config.usePagination || (config.usePagination && pagination.currentPage === 1)) && postCount > 1) {
			app.alert({
				alert_id: 'bookmark',
				message: '[[topic:bookmark_instructions]]',
				timeout: 0,
				type: 'info',
				clickfn : function() {
					Topic.scrollToPost(parseInt(bookmark, 10), true);
				},
				closefn : function() {
					localStorage.removeItem('topic:' + tid + ':bookmark');
				}
			});
		}

		if (!config.usePagination) {
			navigator.init('.posts > .post-row', postCount, Topic.navigatorCallback);
		}

		socket.on('event:new_post', onNewPost);

		$(window).on('scroll', updateTopicTitle);

		$(window).trigger('action:topic.loaded');
	};

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

		socket.emit('topics.markAsRead', {tid: tid, uid: app.uid});
		createNewPosts(data);
	}

	function addBlockquoteEllipses(blockquotes) {
		blockquotes.each(function() {
			var $this = $(this);
			if ($this.find(':hidden').length && !$this.find('.toggle').length) {
				$this.append('<i class="fa fa-ellipsis-h pointer toggle"></i>');
			}
		});
		
		$('blockquote .toggle').on('click', function() {
			$(this).parent('blockquote').toggleClass('uncollapsed');
		});
	}

	function enableInfiniteLoading() {
		if(!config.usePagination) {

			app.enableInfiniteLoading(function(direction) {

				if (!infiniteLoaderActive && $('#post-container').children().length) {
					var after = 0;
					var el = null;
					if(direction > 0) {
						el = $('#post-container .post-row').last();
						after = parseInt(el.attr('data-index'), 10) + 1;
					} else {
						el = $('#post-container .post-row').first();
						after = parseInt(el.attr('data-index'), 10);
						after -= config.postsPerPage;
						if(after < 0) {
							after = 0;
						}
					}

					var offset = el.offset().top - $('#header-menu').offset().top + $('#header-menu').height();

					loadMorePosts(ajaxify.variables.get('topic_id'), after, function() {
						hidePostToolsForDeletedPosts();
						if(direction < 0 && el) {
							Topic.scrollToPost(el.attr('data-pid'), false, 0, offset);
						}
					});
				}
			});
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

	Topic.navigatorCallback = function(element) {
		var pid = element.attr('data-pid');

		var currentBookmark = localStorage.getItem('topic:' + ajaxify.variables.get('topic_id') + ':bookmark');

		if (!currentBookmark || parseInt(pid, 10) >= parseInt(currentBookmark, 10)) {
			localStorage.setItem('topic:' + ajaxify.variables.get('topic_id') + ':bookmark', pid);
			app.removeAlert('bookmark');
		}

		if (!scrollingToPost) {

			var newUrl = window.location.href.replace(window.location.hash, '') + '#' + pid;

			if (newUrl !== currentUrl) {
				if (history.replaceState) {
					history.replaceState({
						url: window.location.pathname.slice(1) + (window.location.search ? window.location.search : '' ) + '#' + pid
					}, null, newUrl);
				}
				currentUrl = newUrl;
			}
		}
	};

	Topic.scrollToPost = function(pid, highlight, duration, offset) {
		if (!pid) {
			return;
		}

		if(!offset) {
			offset = 0;
		}

		scrollingToPost = true;

		if($('#post_anchor_' + pid).length) {
			return scrollToPid(pid);
		}

		if(config.usePagination) {
			socket.emit('posts.getPidPage', pid, function(err, page) {
				if(err) {
					return;
				}
				if(parseInt(page, 10) !== pagination.currentPage) {
					pagination.loadPage(page, function() {
						scrollToPid(pid);
					});
				} else {
					scrollToPid(pid);
				}
			});
		} else {
			socket.emit('posts.getPidIndex', pid, function(err, index) {
				if(err) {
					return;
				}
				var tid = $('#post-container').attr('data-tid');
				$('#post-container').empty();
				var after = index - config.postsPerPage + 1;
				if(after < 0) {
					after = 0;
				}

				loadMorePosts(tid, after, function() {
					scrollToPid(pid);
				});
			});
		}

		function scrollToPid(pid) {
			var scrollTo = $('#post_anchor_' + pid),
				tid = $('#post-container').attr('data-tid');

			function animateScroll() {
				$("html, body").animate({
					scrollTop: (scrollTo.offset().top - $('#header-menu').height() - offset) + "px"
				}, duration !== undefined ? duration : 400, function() {
					scrollingToPost = false;
					navigator.update();
					highlightPost();
				});
			}

			function highlightPost() {
				if (highlight) {
					scrollTo.parent().find('.topic-item').addClass('highlight');
					setTimeout(function() {
						scrollTo.parent().find('.topic-item').removeClass('highlight');
					}, 5000);
				}
			}


			if (tid && scrollTo.length) {
				if($('#post-container li.post-row[data-pid="' + pid + '"]').attr('data-index') !== '0') {
					animateScroll();
				} else {
					navigator.update();
					highlightPost();
				}
			}
		}
	};

	function onNewPostPagination(data) {
		var posts = data.posts;
		socket.emit('topics.getPageCount', ajaxify.variables.get('topic_id'), function(err, newPageCount) {

			pagination.recreatePaginationLinks(newPageCount);

			if(pagination.currentPage === pagination.pageCount) {
				createNewPosts(data);
			} else if(data.posts && data.posts.length && parseInt(data.posts[0].uid, 10) === parseInt(app.uid, 10)) {
				pagination.loadPage(pagination.pageCount);
			}
		});
	}

	function createNewPosts(data, callback) {
		if(!data || (data.posts && !data.posts.length)) {
			return;
		}

		function removeAlreadyAddedPosts() {
			data.posts = data.posts.filter(function(post) {
				return $('#post-container li[data-pid="' + post.pid +'"]').length === 0;
			});
		}

		var after = null,
			before = null;

		function findInsertionPoint() {
			var firstPid = parseInt(data.posts[0].pid, 10);

			$('#post-container li[data-pid]').each(function() {
				var $this = $(this);

				addBlockquoteEllipses($this.find('.post-content > blockquote'));

				if(firstPid > parseInt($this.attr('data-pid'), 10)) {
					after = $this;
					if(after.next().length && after.next().hasClass('post-bar')) {
						after = after.next();
					}
				} else {
					return false;
				}
			});

			if(!after) {
				var firstPost = $('#post-container .post-row').first();
				if(firstPid < parseInt(firstPost.attr('data-pid'), 10)) {
					before = firstPost;
				}
			}
		}

		removeAlreadyAddedPosts();
		if(!data.posts.length) {
			return;
		}

		findInsertionPoint();

		data.title = ajaxify.variables.get('topic_name');
		data.viewcount = ajaxify.variables.get('viewcount');

		parseAndTranslatePosts(data, function(translatedHTML) {
			var translated = $(translatedHTML);

			if(after) {
				translated.insertAfter(after);
			} else if(before) {
				translated.insertBefore(before);
			} else {
				$('#post-container').append(translated);
			}

			translated.hide().fadeIn('slow');

			onNewPostsLoaded(translated, data.posts);

			if(typeof callback === 'function') {
				callback();
			}
		});
	}

	function parseAndTranslatePosts(data, callback) {
		ajaxify.loadTemplate('topic', function(topicTemplate) {
			var html = templates.parse(templates.getBlock(topicTemplate, 'posts'), data);
			translator.translate(html, callback);
		});
	}

	function onNewPostsLoaded(html, posts) {
		function getPostPrivileges(pid) {
			socket.emit('posts.getPrivileges', pid, function(err, privileges) {
				if(err) {
					return app.alertError(err.message);
				}
				toggleModTools(html, privileges);
			});
		}

		for (var x = 0, numPosts = posts.length; x < numPosts; x++) {
			getPostPrivileges(posts[x].pid);
		}

		infiniteLoaderActive = false;

		app.populateOnlineUsers();
		app.createUserTooltips();
		utils.addCommasToNumbers(html.find('.formatted-number'));
		utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
		html.find('span.timeago').timeago();
		html.find('.post-content img').addClass('img-responsive');
		postTools.updatePostCount();
		showBottomPostBar();
	}

	function toggleModTools(postHtml, privileges) {
		postHtml.find('.edit, .delete').toggleClass('none', !privileges.editable);
		postHtml.find('.move').toggleClass('none', !privileges.move);
	}

	function loadMorePosts(tid, after, callback) {
		var indicatorEl = $('.loading-indicator');

		if (infiniteLoaderActive || !$('#post-container').length) {
			return;
		}

		if (!utils.isNumber(after) || (after === 0 && $('#post-container li.post-row[data-index="0"]').length)) {
			return;
		}

		infiniteLoaderActive = true;
		indicatorEl.fadeIn();

		socket.emit('topics.loadMore', {
			tid: tid,
			after: after
		}, function (err, data) {

			indicatorEl.fadeOut(function() {
				infiniteLoaderActive = false;
			});

			if(err) {
				return app.alertError(err.message);
			}

			if (data && data.posts && data.posts.length) {
				createNewPosts(data, callback);
			} else {
				navigator.update();
				if (typeof callback === 'function') {
					callback(data.posts);
				}
			}
		});
	}

	return Topic;
});
