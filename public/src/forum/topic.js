'use strict';


/* globals define, app, templates, translator, socket, bootbox, config, ajaxify, RELATIVE_PATH */

define(['forum/pagination', 'forum/topic/threadTools', 'forum/topic/postTools'], function(pagination, threadTools, postTools) {
	var	Topic = {},
		infiniteLoaderActive = false,
		scrollingToPost = false,
		currentUrl = '';

	function showBottomPostBar() {
		if($('#post-container .post-row').length > 1 || !$('#post-container li[data-index="0"]').length) {
			$('.bottom-post-bar').removeClass('hide');
		}
	}

	$(window).on('action:ajaxify.start', function(ev, data) {
		if(data.url.indexOf('topic') !== 0) {
			$('.pagination-block').addClass('hidden');
			$('.header-topic-title').find('span').text('').hide();
			app.removeAlert('bookmark');
		}
	});

	Topic.init = function() {
		var tid = ajaxify.variables.get('topic_id'),
			thread_state = {
				locked: ajaxify.variables.get('locked'),
				deleted: ajaxify.variables.get('deleted'),
				pinned: ajaxify.variables.get('pinned')
			},
			currentPage = parseInt(ajaxify.variables.get('currentPage'), 10),
			pageCount = parseInt(ajaxify.variables.get('pageCount'), 10);

		Topic.postCount = ajaxify.variables.get('postcount');

		$(window).trigger('action:topic.loading');

		function hidePostToolsForDeletedPosts() {
			$('#post-container li.deleted').each(function() {
				toggle_post_tools($(this).attr('data-pid'), true);
			});
		}

		$(function() {
			utils.addCommasToNumbers($('.topic .formatted-number'));

			app.enterRoom('topic_' + tid);

			showBottomPostBar();

			if (thread_state.locked === '1') {
				set_locked_state(true);
			}

			if (thread_state.deleted === '1') {
				set_delete_state(true);
			}

			if (thread_state.pinned === '1') {
				set_pinned_state(true);
			}

			postTools.init(tid, thread_state);
			threadTools.init(tid, thread_state);

			hidePostToolsForDeletedPosts();

			enableInfiniteLoading();

			var bookmark = localStorage.getItem('topic:' + tid + ':bookmark');
			if (window.location.hash) {
				Topic.scrollToPost(window.location.hash.substr(1), true);
			} else if (bookmark && (!config.usePagination || (config.usePagination && pagination.currentPage === 1)) && Topic.postCount > 1) {
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

			if (!window.location.hash && !config.usePagination) {
				updateHeader();
			}

			$('#post-container').on('mouseenter', '.favourite-tooltip', function(e) {
				if (!$(this).data('users-loaded')) {
					$(this).data('users-loaded', "true");
					var pid = $(this).parents('.post-row').attr('data-pid');
					var el = $(this).attr('title', "Loading...");
					socket.emit('posts.getFavouritedUsers', pid, function(err, usernames) {
						el.attr('title', usernames).tooltip('show');
					});
				}
			});
		});


		function enableInfiniteLoading() {
			if(!config.usePagination) {
				$('.pagination-block').removeClass('hidden');

				updatePaginationTextAndProgressBar(1);

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

						loadMorePosts(tid, after, function() {
							hidePostToolsForDeletedPosts();
							if(direction < 0 && el) {
								Topic.scrollToPost(el.attr('data-pid'), false, 0, offset);
							}
						});
					}
				});
			} else {
				$('.pagination-block').addClass('hidden');

				pagination.init(currentPage, pageCount);
			}
		}


		ajaxify.register_events([
			'event:rep_up', 'event:rep_down', 'event:favourited', 'event:unfavourited', 'event:new_post', 'get_users_in_room',
			'event:topic_deleted', 'event:topic_restored', 'event:topic:locked',
			'event:topic_unlocked', 'event:topic_pinned', 'event:topic_unpinned',
			'event:topic_moved', 'event:post_edited', 'event:post_deleted', 'event:post_restored',
			'posts.favourite', 'user.isOnline', 'posts.upvote', 'posts.downvote',
			'event:topic.replyStart', 'event:topic.replyStop'
		]);

		function createUserIcon(uid, picture, userslug, username) {
			if(!$('.thread_active_users').find('[data-uid="' + uid + '"]').length) {
				var div = $('<div class="inline-block"><a data-uid="' + uid + '" href="' + RELATIVE_PATH + '/user/' + userslug + '"><img src="'+ picture +'"/></a></div>');
				div.find('a').tooltip({
					placement: 'top',
					title: username
				});

				return div;
			}
		}

		socket.on('get_users_in_room', function(data) {
			if(data && data.room.indexOf('topic') !== -1) {
				var activeEl = $('.thread_active_users');

				// remove users that are no longer here
				activeEl.find('a').each(function(index, element) {
					if(element) {
						var uid = $(element).attr('data-uid');
						var absent = data.users.every(function(user) {
							return parseInt(user.uid, 10) !== parseInt(uid, 10);
						});

						if (absent) {
							$(element).remove();
						}
					}
				});

				var i=0, icon;
				// add self
				for(i = 0; i<data.users.length; ++i) {
					if(parseInt(data.users[i].uid, 10) === parseInt(app.uid, 10)) {
						icon = createUserIcon(data.users[i].uid, data.users[i].picture, data.users[i].userslug, data.users[i].username);
						activeEl.prepend(icon);
						data.users.splice(i, 1);
						break;
					}
				}
				// add other users
				for(i=0; i<data.users.length; ++i) {
					icon = createUserIcon(data.users[i].uid, data.users[i].picture, data.users[i].userslug, data.users[i].username);
					activeEl.append(icon);
					if(activeEl.children().length > 8) {
						break;
					}
				}

				var remainingUsers = data.users.length - 9;
				remainingUsers = remainingUsers < 0 ? 0 : remainingUsers;
				var anonymousCount = parseInt(data.anonymousCount, 10);
				activeEl.find('.anonymous-box').remove();
				if(anonymousCount || remainingUsers) {

					var anonLink = $('<div class="anonymous-box inline-block"><i class="fa fa-user"></i></div>');
					activeEl.append(anonLink);

					var title = '';
					if(remainingUsers && anonymousCount) {
						title = remainingUsers + ' more user(s) and ' + anonymousCount + ' guest(s)';
					} else if(remainingUsers) {
						title = remainingUsers + ' more user(s)';
					} else {
						title = anonymousCount + ' guest(s)';
					}

					anonLink.tooltip({
						placement: 'top',
						title: title
					});
				}

				// Get users who are currently replying to the topic entered
				socket.emit('modules.composer.getUsersByTid', ajaxify.variables.get('topic_id'), function(err, uids) {
					if (uids && uids.length) {
						for(var x=0;x<uids.length;x++) {
							activeEl.find('[data-uid="' + uids[x] + '"]').addClass('replying');
						}
					}
				});
			}

			app.populateOnlineUsers();
		});

		socket.on('user.isOnline', function(err, data) {
			app.populateOnlineUsers();
		});

		socket.on('event:rep_up', function(data) {
			adjust_rep(1, data.pid, data.uid);
		});

		socket.on('event:rep_down', function(data) {
			adjust_rep(-1, data.pid, data.uid);
		});

		socket.on('event:favourited', function(data) {
			adjust_favourites(1, data.pid, data.uid);
		});

		socket.on('event:unfavourited', function(data) {
			adjust_favourites(-1, data.pid, data.uid);
		});

		socket.on('event:new_post', function(data) {
			if(data && data.posts && data.posts.length && data.posts[0].tid !== ajaxify.variables.get('topic_id')) {
				return;
			}

			if(config.usePagination) {
				onNewPostPagination(data);
				return;
			}

			for (var i=0; i<data.posts.length; ++i) {
				var postcount = $('.user_postcount_' + data.posts[i].uid);
				postcount.html(parseInt(postcount.html(), 10) + 1);
			}

			socket.emit('topics.markAsRead', {tid: tid, uid: app.uid});
			createNewPosts(data);
		});

		socket.on('event:topic_deleted', function(data) {
			if (data && data.tid === tid) {
				set_locked_state(true);
				set_delete_state(true);
			}
		});

		socket.on('event:topic_restored', function(data) {
			if (data && data.tid === tid) {
				set_locked_state(false);
				set_delete_state(false);
			}
		});

		socket.on('event:topic_locked', function(data) {
			if (data && data.tid === tid) {
				set_locked_state(true, 1);
			}
		});

		socket.on('event:topic_unlocked', function(data) {
			if (data && data.tid === tid) {
				set_locked_state(false, 1);
			}
		});

		socket.on('event:topic_pinned', function(data) {
			if (data && data.tid === tid) {
				set_pinned_state(true, 1);
			}
		});

		socket.on('event:topic_unpinned', function(data) {
			if (data && data.tid === tid) {
				set_pinned_state(false, 1);
			}
		});

		socket.on('event:topic_moved', function(data) {
			if (data && data.tid > 0) {
				ajaxify.go('topic/' + data.tid);
			}
		});

		socket.on('event:post_edited', function(data) {
			var editedPostEl = $('#content_' + data.pid),
				editedPostTitle = $('#topic_title_' + data.pid);

			if (editedPostTitle.length) {
				editedPostTitle.fadeOut(250, function() {
					editedPostTitle.html(data.title);
					editedPostTitle.fadeIn(250);
				});
			}

			editedPostEl.fadeOut(250, function() {
				editedPostEl.html(data.content);
				editedPostEl.find('img').addClass('img-responsive');
				editedPostEl.fadeIn(250);
			});
		});

		socket.on('posts.upvote', function(data) {
			if (data && data.pid) {
				$('li[data-pid="' + data.pid + '"] .upvote').addClass('btn-primary upvoted');
			}
		});

		socket.on('posts.downvote', function(data) {
			if (data && data.pid) {
				$('li[data-pid="' + data.pid + '"] .downvote').addClass('btn-primary downvoted');
			}
		});

		socket.on('posts.unvote', function(data) {
			if (data && data.pid) {
				var post = $('li[data-pid="' + data.pid + '"]');

				post.find('.upvote').removeClass('btn-primary upvoted');
				post.find('.downvote').removeClass('btn-primary downvoted');
			}
		});

		socket.on('posts.favourite', function(data) {
			if (data && data.pid) {
				toggleFavourite(data.pid, true);
			}
		});

		socket.on('posts.unfavourite', function(data) {
			if (data && data.pid) {
				toggleFavourite(data.pid, false);
			}
		});

		function toggleFavourite(pid, isFavourited) {
			var favBtn = $('li[data-pid="' + pid + '"] .favourite');
			if(favBtn.length) {
				favBtn.addClass('btn-warning')
					.attr('data-favourited', isFavourited);

				var icon = favBtn.find('i');
				var className = icon.attr('class');

				if (isFavourited ? className.indexOf('-o') !== -1 : className.indexOf('-o') === -1) {
					icon.attr('class', isFavourited ? className.replace('-o', '') : className + '-o');
				}
			}
		}

		socket.on('event:post_deleted', function(data) {
			if (data.pid) {
				toggle_post_delete_state(data.pid);
			}
		});

		socket.on('event:post_restored', function(data) {
			if (data.pid) {
				toggle_post_delete_state(data.pid);
			}
		});

		socket.on('event:topic.replyStart', function(uid) {
			$('.thread_active_users [data-uid="' + uid + '"]').addClass('replying');
		});

		socket.on('event:topic.replyStop', function(uid) {
			$('.thread_active_users [data-uid="' + uid + '"]').removeClass('replying');
		});

		function adjust_rep(value, pid, uid) {
			var votes = $('li[data-pid="' + pid + '"] .votes'),
				reputationElements = $('.reputation[data-uid="' + uid + '"]'),
				currentVotes = parseInt(votes.attr('data-votes'), 10),
				reputation = parseInt(reputationElements.attr('data-reputation'), 10);

			currentVotes += value;
			reputation += value;

			votes.html(currentVotes).attr('data-votes', currentVotes);
			reputationElements.html(reputation).attr('data-reputation', reputation);
		}

		function adjust_favourites(value, pid, uid) {
			var favourites = $('li[data-pid="' + pid + '"] .favouriteCount'),
				currentFavourites = parseInt(favourites.attr('data-favourites'), 10);

			currentFavourites += value;

			favourites.html(currentFavourites).attr('data-favourites', currentFavourites);
		}

		function set_locked_state(locked, alert) {
			translator.translate('<i class="fa fa-fw fa-' + (locked ? 'un': '') + 'lock"></i> [[topic:thread_tools.' + (locked ? 'un': '') + 'lock]]', function(translated) {
				$('.lock_thread').html(translated);
			});

			$('#post-container .post_reply').html(locked ? 'Locked <i class="fa fa-lock"></i>' : 'Reply <i class="fa fa-reply"></i>');
			$('#post-container').find('.quote, .edit, .delete').toggleClass('none', locked);
			$('.topic-main-buttons .post_reply').attr('disabled', locked).html(locked ? 'Locked <i class="fa fa-lock"></i>' : 'Reply');

			if (alert) {
				app.alert({
					'alert_id': 'thread_lock',
					type: 'success',
					title: 'Thread ' + (locked ? 'Locked' : 'Unlocked'),
					message: 'Thread has been successfully ' + (locked ? 'locked' : 'unlocked'),
					timeout: 5000
				});
			}

			thread_state.locked = locked ? '1' : '0';
		}

		function set_delete_state(deleted) {
			var threadEl = $('#post-container');

			translator.translate('<i class="fa fa-fw ' + (deleted ? 'fa-comment' : 'fa-trash-o') + '"></i> [[topic:thread_tools.' + (deleted ? 'restore' : 'delete') + ']]', function(translated) {
				$('.delete_thread span').html(translated);
			});

			threadEl.toggleClass('deleted', deleted);
			thread_state.deleted = deleted ? '1' : '0';

			if(deleted) {
				translator.translate('[[topic:deleted_message]]', function(translated) {
					$('<div id="thread-deleted" class="alert alert-warning">' + translated + '</div>').insertBefore(threadEl);
				});
			} else {
				$('#thread-deleted').remove();
			}
		}

		function set_pinned_state(pinned, alert) {
			translator.translate('<i class="fa fa-fw fa-thumb-tack"></i> [[topic:thread_tools.' + (pinned ? 'unpin' : 'pin') + ']]', function(translated) {
				$('.pin_thread').html(translated);

				if (alert) {
					app.alert({
						'alert_id': 'thread_pin',
						type: 'success',
						title: 'Thread ' + (pinned ? 'Pinned' : 'Unpinned'),
						message: 'Thread has been successfully ' + (pinned ? 'pinned' : 'unpinned'),
						timeout: 5000
					});
				}
				thread_state.pinned = pinned ? '1' : '0';
			});
		}

		function toggle_post_delete_state(pid) {
			var postEl = $('#post-container li[data-pid="' + pid + '"]');

			if (postEl.length) {
				postEl.toggleClass('deleted');

				toggle_post_tools(pid, postEl.hasClass('deleted'));

				updatePostCount();
			}
		}

		function toggle_post_tools(pid, isDeleted) {
			var postEl = $('#post-container li[data-pid="' + pid + '"]');

			postEl.find('.quote, .favourite, .post_reply, .chat').toggleClass('none', isDeleted);

			translator.translate(isDeleted ? ' [[topic:restore]]' : ' [[topic:delete]]', function(translated) {
				postEl.find('.delete').find('span').html(translated);
			});
		}

		$(window).on('scroll', updateHeader);
		$(window).trigger('action:topic.loaded');
	};

	function updateHeader() {

		$('.pagination-block a').off('click').on('click', function() {
			return false;
		});

		$('.pagination-block i:first').off('click').on('click', function() {
			app.scrollToTop();
		});

		$('.pagination-block i:last').off('click').on('click', function() {
			app.scrollToBottom();
		});

		if($(window).scrollTop() > 50) {
			$('.header-topic-title').find('span').text(ajaxify.variables.get('topic_name')).show();
		} else {
			$('.header-topic-title').find('span').text('').hide();
		}

		$($('.posts > .post-row').get().reverse()).each(function() {
			var el = $(this);

			if (elementInView(el)) {
				var index = parseInt(el.attr('data-index'), 10) + 1;
				if(index > Topic.postCount) {
					index = Topic.postCount;
				}

				updatePaginationTextAndProgressBar(index);

				var currentBookmark = localStorage.getItem('topic:' + ajaxify.variables.get('topic_id') + ':bookmark');
				if (!currentBookmark || parseInt(el.attr('data-pid'), 10) >= parseInt(currentBookmark, 10)) {
					localStorage.setItem('topic:' + ajaxify.variables.get('topic_id') + ':bookmark', el.attr('data-pid'));
					app.removeAlert('bookmark');
				}

				if (!scrollingToPost) {

					var newUrl = window.location.href.replace(window.location.hash, '') + '#' + el.attr('data-pid');

					if (newUrl !== currentUrl) {
						if (history.replaceState) {
							history.replaceState({
								url: window.location.pathname.slice(1) + (window.location.search ? window.location.search : '' ) + '#' + el.attr('data-pid')
							}, null, newUrl);
						}
						currentUrl = newUrl;
					}
				}

				return false;
			}
		});
	}

	function updatePaginationTextAndProgressBar(index) {
		$('#pagination').html(index + ' out of ' + Topic.postCount);
		$('.progress-bar').width((index / Topic.postCount * 100) + '%');
	}

	function elementInView(el) {
		var scrollTop = $(window).scrollTop() + $('#header-menu').height();
		var scrollBottom = scrollTop + $(window).height();

		var elTop = el.offset().top;
		var elBottom = elTop + Math.floor(el.height());
		return (elTop >= scrollTop && elBottom <= scrollBottom) || (elTop <= scrollTop && elBottom >= scrollTop);
	}

	Topic.scrollToPost = function(pid, highlight, duration, offset) {
		if (!pid) {
			return;
		}

		if(!offset) {
			offset = 0;
		}

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
				scrollingToPost = true;

				$("html, body").animate({
					scrollTop: (scrollTo.offset().top - $('#header-menu').height() - offset) + "px"
				}, duration !== undefined ? duration : 400, function() {
					scrollingToPost = false;
					updateHeader();
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
					updateHeader();
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
				if(firstPid > parseInt($(this).attr('data-pid'), 10)) {
					after = $(this);
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
		for (var x = 0, numPosts = posts.length; x < numPosts; x++) {
			toggle_mod_tools(posts[x].pid, posts[x].display_moderator_tools);
		}

		infiniteLoaderActive = false;

		app.populateOnlineUsers();
		app.createUserTooltips();
		utils.addCommasToNumbers(html.find('.formatted-number'));
		utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
		html.find('span.timeago').timeago();
		html.find('.post-content img').addClass('img-responsive');
		updatePostCount();
		showBottomPostBar();
	}


	function toggle_mod_tools(pid, editable) {
		$('#post-container li[data-pid="' + pid + '"]').find('.edit, .delete').toggleClass('none', !editable);
	}

	function updatePostCount() {
		socket.emit('topics.postcount', ajaxify.variables.get('topic_id'), function(err, postcount) {
			if(!err) {
				Topic.postCount = postcount;
				$('#topic-post-count').html(Topic.postCount);
				updateHeader();
			}
		});
	}

	function loadMorePosts(tid, after, callback) {
		var indicatorEl = $('.loading-indicator');

		if (infiniteLoaderActive || !$('#post-container').length) {
			return;
		}

		if(after === 0 && $('#post-container li.post-row[data-index="0"]').length) {
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
				updateHeader();
				if (typeof callback === 'function') {
					callback(data.posts);
				}
			}
		});
	}

	return Topic;
});