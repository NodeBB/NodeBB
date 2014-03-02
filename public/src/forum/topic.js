define(['composer', 'forum/pagination'], function(composer, pagination) {
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
			$('.pagination-block').addClass('hide');
			$('#header-topic-title').html('').hide();
			app.removeAlert('bookmark');
		}
	});

	Topic.init = function() {
		var expose_tools = templates.get('expose_tools'),
			tid = templates.get('topic_id'),
			thread_state = {
				locked: templates.get('locked'),
				deleted: templates.get('deleted'),
				pinned: templates.get('pinned')
			},
			topic_name = templates.get('topic_name'),
			currentPage = parseInt(templates.get('currentPage'), 10),
			pageCount = parseInt(templates.get('pageCount'), 10);

		Topic.postCount = templates.get('postcount');

		$(window).trigger('action:topic.loading');

		function fixDeleteStateForPosts() {
			var postEls = $('#post-container li[data-deleted]');
			for (var x = 0, numPosts = postEls.length; x < numPosts; x++) {
				if (postEls.eq(x).attr('data-deleted') === '1') {
					toggle_post_delete_state(postEls.eq(x).attr('data-pid'));
				}
				postEls.eq(x).removeAttr('data-deleted');
			}
		}

		$(function() {
			app.addCommasToNumbers();

			app.enterRoom('topic_' + tid);

			showBottomPostBar();

			if (thread_state.locked === '1') set_locked_state(true);
			if (thread_state.deleted === '1') set_delete_state(true);
			if (thread_state.pinned === '1') set_pinned_state(true);

			if (expose_tools === '1') {
				var moveThreadModal = $('#move_thread_modal');
				$('.thread-tools').removeClass('hide');

				// Add events to the thread tools
				$('.delete_thread').on('click', function(e) {
					if (thread_state.deleted !== '1') {
						bootbox.confirm('Are you sure you want to delete this thread?', function(confirm) {
							if (confirm) {
								socket.emit('topics.delete', tid);
							}
						});
					} else {
						bootbox.confirm('Are you sure you want to restore this thread?', function(confirm) {
							if (confirm) {
								socket.emit('topics.restore', tid);
							}
						});
					}
					return false;
				});

				$('.lock_thread').on('click', function(e) {
					if (thread_state.locked !== '1') {
						socket.emit('topics.lock', tid);
					} else {
						socket.emit('topics.unlock', tid);
					}
					return false;
				});

				$('.pin_thread').on('click', function(e) {
					if (thread_state.pinned !== '1') {
						socket.emit('topics.pin', tid);
					} else {
						socket.emit('topics.unpin', tid);
					}
					return false;
				});

				$('.move_thread').on('click', function(e) {
					moveThreadModal.modal('show');
					return false;
				});

				$('.markAsUnreadForAll').on('click', function() {
					var btn = $(this);
					socket.emit('topics.markAsUnreadForAll', tid, function(err) {
						if(err) {
							return app.alertError(err.message);
						}
						app.alertSuccess('[[topic:markAsUnreadForAll.success]]');
						btn.parents('.thread-tools.open').find('.dropdown-toggle').trigger('click');
					});
					return false;
				});

				moveThreadModal.on('shown.bs.modal', function() {

					var loadingEl = $('#categories-loading');
					if (loadingEl.length) {
						socket.emit('categories.get', function(err, data) {

							// Render categories
							var categoryEl,
								numCategories = data.categories.length,
								modalBody = moveThreadModal.find('.modal-body'),
								categoriesEl = modalBody.find('ul').eq(0).addClass('categories-list'),
								confirmDiv = $('#move-confirm'),
								confirmCat = confirmDiv.find('span').eq(0),
								commitEl = $('#move_thread_commit'),
								cancelEl = $('#move_thread_cancel'),
								x, info, targetCid, targetCatLabel;

							for (x = 0; x < numCategories; x++) {
								info = data.categories[x];
								categoryEl = $('<li />');
								categoryEl.css({background: info.bgColor, color: info.color || '#fff'})
									.addClass(info.disabled === '1' ? ' disabled' : '')
									.attr('data-cid', info.cid)
									.html('<i class="fa ' + info.icon + '"></i> ' + info.name);

								categoriesEl.append(categoryEl);
							}
							loadingEl.remove();

							categoriesEl.on('click', 'li[data-cid]', function(e) {
								var el = $(this);
								if (el.is('li')) {
									confirmCat.html(el.html());
									confirmDiv.css({display: 'block'});
									targetCid = el.attr('data-cid');
									targetCatLabel = el.html();
									commitEl.prop('disabled', false);
								}
							});

							commitEl.on('click', function() {
								if (!commitEl.prop('disabled') && targetCid) {
									commitEl.prop('disabled', true);
									cancelEl.fadeOut(250);
									moveThreadModal.find('.modal-header button').fadeOut(250);
									commitEl.html('Moving <i class="fa-spin fa-refresh"></i>');

									socket.emit('topics.move', {
										tid: tid,
										cid: targetCid
									}, function(err) {
										moveThreadModal.modal('hide');
										if(err) {
											return app.alert({
												'alert_id': 'thread_move',
												type: 'danger',
												title: 'Unable to Move Topic',
												message: 'This topic could not be moved to ' + targetCatLabel + '.<br />Please try again later',
												timeout: 5000
											});
										}

										app.alert({
											'alert_id': 'thread_move',
											type: 'success',
											title: 'Topic Successfully Moved',
											message: 'This topic has been successfully moved to ' + targetCatLabel,
											timeout: 5000
										});
									});
								}
							});
						});
					}
				});

				$('.fork_thread').on('click', function() {
					var pids = [];
					var forkModal = $('#fork-thread-modal'),
						forkCommit = forkModal.find('#fork_thread_commit');
					forkModal.removeClass('hide');
					forkModal.css('position', 'fixed')
						.css('left', Math.max(0, (($(window).width() - $(forkModal).outerWidth()) / 2) + $(window).scrollLeft()) + 'px')
						.css('top', '0px')
						.css('z-index', '2000');

					showNoPostsSelected();

					forkModal.find('.close,#fork_thread_cancel').on('click', closeForkModal);
					forkModal.find('#fork-title').on('change', checkForkButtonEnable);
					$('#post-container').on('click', 'li', togglePostSelection);
					forkCommit.on('click', createTopicFromPosts);

					function createTopicFromPosts() {
						socket.emit('topics.createTopicFromPosts', {
							title: forkModal.find('#fork-title').val(),
							pids: pids
						}, function(err) {
							if(err) {
								return app.alertError(err.message);
							}

							translator.get('topic:fork_success', function(translated) {
								app.alertSuccess(translated);
							});

							for(var i=0; i<pids.length; ++i) {
								$('#post-container li[data-pid="' + pids[i] + '"]').fadeOut(500, function() {
									$(this).remove();
								});
							}
							closeForkModal();
						});
					}

					function togglePostSelection() {

						var newPid = $(this).attr('data-pid');

						if($(this).attr('data-index') === '0') {
							return;
						}

						if(newPid) {
							var index = pids.indexOf(newPid);
							if(index === -1) {
								pids.push(newPid);
								$(this).css('opacity', '0.5');
							} else {
								pids.splice(index, 1);
								$(this).css('opacity', '1.0');
							}

							if(pids.length) {
								pids.sort();
								forkModal.find('#fork-pids').html(pids.toString());
							} else {
								showNoPostsSelected();
							}
							checkForkButtonEnable();
						}
					}

					function closeForkModal() {
						for(var i=0; i<pids.length; ++i) {
							$('#post-container li[data-pid="' + pids[i] + '"]').css('opacity', 1);
						}
						forkModal.addClass('hide');
						$('#post-container').off('click', 'li');
					}

					function checkForkButtonEnable() {
						if(forkModal.find('#fork-title').length && pids.length) {
							forkCommit.removeAttr('disabled');
						} else {
							forkCommit.attr('disabled', true);
						}
					}

					function showNoPostsSelected() {
						translator.get('topic:fork_no_pids', function(translated) {
							forkModal.find('#fork-pids').html(translated);
						});
					}
				});
			}

			fixDeleteStateForPosts();


			socket.emit('topics.followCheck', tid, function(err, state) {
				set_follow_state(state, false);
			});

			$('.posts .follow').on('click', function() {
				socket.emit('topics.follow', tid, function(err, state) {
					if(err) {
						return app.alert({
							type: 'danger',
							alert_id: 'topic_follow',
							title: '[[global:please_log_in]]',
							message: '[[topic:login_to_subscribe]]',
							timeout: 5000
						});
					}

					set_follow_state(state, true);
				});

				return false;
			});

			enableInfiniteLoading();

			var bookmark = localStorage.getItem('topic:' + tid + ':bookmark');
			if (window.location.hash) {
				Topic.scrollToPost(window.location.hash.substr(1), true);
			} else if (bookmark && (!config.usePagination || (config.usePagination && pagination.currentPage === 1))) {
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
				$('.pagination-block').removeClass('hide');

				app.enableInfiniteLoading(function(direction) {

					if (!infiniteLoaderActive && $('#post-container').children().length) {
						var after = 0;
						var el = null;
						if(direction > 0) {
							el = $('#post-container .post-row.infiniteloaded').last();
							after = parseInt(el.attr('data-index'), 10) + 1;
						} else {
							el = $('#post-container .post-row.infiniteloaded').first();
							after = parseInt(el.attr('data-index'), 10);
							after -= config.postsPerPage;
							if(after < 0) {
								after = 0;
							}
						}

						var offset = el.offset().top - $('#header-menu').offset().top + $('#header-menu').height();

						loadMorePosts(tid, after, function() {
							fixDeleteStateForPosts();
							if(direction < 0 && el) {
								Topic.scrollToPost(el.attr('data-pid'), false, 0, offset);
							}
						});
					}
				});
			} else {
				$('.pagination-block').addClass('hide');

				pagination.init(currentPage, pageCount);
			}
		}

		$('.topic').on('click', '.post_reply', function() {
			var selectionText = '',
				selection = window.getSelection ? window.getSelection() : document.selection.createRange();

			if ($(selection.baseNode).parents('.post-content').length > 0) {
				var snippet = selection.toString();
				if (snippet.length > 0) {
					selectionText = '> ' + snippet.replace(/\n/g, '\n> ');
				}
			}

			var username = '',
				post = $(this).parents('li[data-pid]'),
				pid = $(this).parents('.post-row').attr('data-pid');
			if (post.length) {
				username = '@' + post.attr('data-username').replace(/\s/g, '-') + ' ';
			}

			if (thread_state.locked !== '1') {
				composer.newReply(tid, pid, topic_name, selectionText.length > 0 ? selectionText + '\n\n' + username : '' + username);
			}
		});

		$('#post-container').on('click', '.quote', function() {
			if (thread_state.locked !== '1') {
				var username = '',
					post = $(this).parents('li[data-pid]'),
					pid = $(this).parents('.post-row').attr('data-pid');

				if (post.length) {
					username = '@' + post.attr('data-username').replace(/\s/g, '-');
				}

				socket.emit('posts.getRawPost', pid, function(err, post) {
					if(err) {
						return app.alertError(err.message);
					}
					var quoted = '';
					if(post) {
						quoted = '> ' + post.replace(/\n/g, '\n> ') + '\n\n';
					}
					if($('.composer').length) {
						composer.addQuote(tid, pid, topic_name, username, quoted);
					}else {
						composer.newReply(tid, pid, topic_name, username + ' said:\n' + quoted);
					}
				});
			}
		});

		$('#post-container').on('click', '.favourite', function() {
			var pid = $(this).parents('.post-row').attr('data-pid');

			var method = $(this).attr('data-favourited') == 'false' ? 'posts.favourite' : 'posts.unfavourite';

			socket.emit(method, {
				pid: pid,
				room_id: app.currentRoom
			});

			return false;
		});

		$('#post-container').on('click', '.upvote', function() {
			var post = $(this).parents('.post-row'),
				pid = post.attr('data-pid'),
				upvoted = post.find('.upvoted').length;

			if (upvoted) {
				socket.emit('posts.unvote', {
					pid: pid,
					room_id: app.currentRoom
				});
			} else {
				socket.emit('posts.upvote', {
					pid: pid,
					room_id: app.currentRoom
				});
			}

			return false;
		});

		$('#post-container').on('click', '.downvote', function() {
			var post = $(this).parents('.post-row'),
				pid = post.attr('data-pid'),
				downvoted = post.find('.downvoted').length;

			if (downvoted) {
				socket.emit('posts.unvote', {
					pid: pid,
					room_id: app.currentRoom
				});
			} else {
				socket.emit('posts.downvote', {
					pid: pid,
					room_id: app.currentRoom
				});
			}

			return false;
		});

		$('#post-container').on('click', '.flag', function() {
			var btn = $(this);
			bootbox.confirm('Are you sure you want to flag this post?', function(confirm) {
				if (confirm) {
					var pid = btn.parents('.post-row').attr('data-pid');
					socket.emit('posts.flag', pid, function(err) {
						if(err) {
							return app.alertError(err.message);
						}
						app.alertSuccess('This post has been flagged for moderation.');
					});
				}
			});
		});


		$('#post-container').on('shown.bs.dropdown', '.share-dropdown', function() {
			var pid = $(this).parents('.post-row').attr('data-pid');
			$('#post_' + pid + '_link').val(window.location.protocol + '//' + window.location.host + window.location.pathname + '#' + pid);
			// without the setTimeout can't select the text in the input
			setTimeout(function() {
				$('#post_' + pid + '_link').putCursorAtEnd().select();
			}, 50);
		});

		$('#post-container').on('click', '.post-link', function(e) {
			e.preventDefault();
			return false;
		});

		$('#post-container').on('click', '.twitter-share', function () {
			var pid = $(this).parents('.post-row').attr('data-pid');
			window.open('https://twitter.com/intent/tweet?url=' + encodeURIComponent(window.location.href + '#' + pid) + '&text=' + topic_name, '_blank', 'width=550,height=420,scrollbars=no,status=no');
			return false;
		});

		$('#post-container').on('click', '.facebook-share', function () {
			var pid = $(this).parents('.post-row').attr('data-pid');
			window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(window.location.href + '#' + pid), '_blank', 'width=626,height=436,scrollbars=no,status=no');
			return false;
		});

		$('#post-container').on('click', '.google-share', function () {
			var pid = $(this).parents('.post-row').attr('data-pid');
			window.open('https://plus.google.com/share?url=' + encodeURIComponent(window.location.href + '#' + pid), '_blank', 'width=500,height=570,scrollbars=no,status=no');
			return false;
		});

		$('#post-container').on('click', '.edit', function(e) {
			var pid = $(this).parents('.post-row').attr('data-pid');

			composer.editPost(pid);
		});

		$('#post-container').on('click', '.delete', function(e) {
			var pid = $(this).parents('.post-row').attr('data-pid'),
				postEl = $(document.querySelector('#post-container li[data-pid="' + pid + '"]')),
				action = !postEl.hasClass('deleted') ? 'delete' : 'restore';

			bootbox.confirm('Are you sure you want to ' + action + ' this post?', function(confirm) {
				if (confirm) {
					socket.emit('posts.' + action, {
						pid: pid,
						tid: tid
					}, function(err) {
						if(err) {
							return app.alertError('Can\'t ' + action + ' post!');
						}
					});
				}
			});
		});

		$('#post-container').on('click', '.move', function(e) {
			var moveModal = $('#move-post-modal'),
				moveBtn = moveModal.find('#move_post_commit'),
				topicId = moveModal.find('#topicId'),
				post = $(this).parents('.post-row'),
				pid = $(this).parents('.post-row').attr('data-pid');

			moveModal.removeClass('hide');
			moveModal.css("position", "fixed")
				.css("left", Math.max(0, (($(window).width() - $(moveModal).outerWidth()) / 2) + $(window).scrollLeft()) + "px")
				.css("top", "0px")
				.css("z-index", "2000");

			moveModal.find('.close,#move_post_cancel').on('click', function() {
				moveModal.addClass('hide');
			});

			topicId.on('change', function() {
				if(topicId.val().length) {
					moveBtn.removeAttr('disabled');
				} else {
					moveBtn.attr('disabled', true);
				}
			});

			moveBtn.on('click', function() {
				socket.emit('topics.movePost', {pid: pid, tid: topicId.val()}, function(err) {
					if(err) {
						$('#topicId').val('');
						moveModal.addClass('hide');
						return app.alertError(err.message);
					}

					post.fadeOut(500, function() {
						post.remove();
					});

					moveModal.addClass('hide');
					$('#topicId').val('');

					app.alertSuccess('Post moved!');
				});
			});
		});


		$('#post-container').on('click', '.chat', function(e) {
			var post = $(this).parents('li.post-row'),
				username = post.attr('data-username'),
				touid = post.attr('data-uid');

			app.openChat(username, touid);
			$(this).parents('.btn-group').find('.dropdown-toggle').click();
			return false;
		});

		ajaxify.register_events([
			'event:rep_up', 'event:rep_down', 'event:favourited', 'event:unfavourited', 'event:new_post', 'get_users_in_room',
			'event:topic_deleted', 'event:topic_restored', 'event:topic:locked',
			'event:topic_unlocked', 'event:topic_pinned', 'event:topic_unpinned',
			'event:topic_moved', 'event:post_edited', 'event:post_deleted', 'event:post_restored',
			'posts.favourite', 'user.isOnline', 'posts.upvote', 'posts.downvote',
			'event:topic.replyStart', 'event:topic.replyStop'
		]);

		socket.on('get_users_in_room', function(data) {

			if(data && data.room.indexOf('topic') !== -1) {
				var activeEl = $('li.post-bar[data-index="0"] .thread_active_users');

				function createUserIcon(uid, picture, userslug, username) {
					if(!activeEl.find('[data-uid="' + uid + '"]').length) {
						var div = $('<div class="inline-block"><a data-uid="' + uid + '" href="' + RELATIVE_PATH + '/user/' + userslug + '"><img src="'+ picture +'"/></a></div>');
						div.find('a').tooltip({
							placement: 'top',
							title: username
						});

						return div;
					}
				}

				// remove users that are no longer here
				activeEl.find('a').each(function(index, element) {
					if(element) {
						var uid = $(element).attr('data-uid');
							absent = data.users.every(function(user) {
								return parseInt(user.uid, 10) !== parseInt(uid, 10);
							});

						if (absent) {
							$(element).remove();
						}
					}
				});

				var i=0;
				// add self
				for(i = 0; i<data.users.length; ++i) {
					if(parseInt(data.users[i].uid, 10) === parseInt(app.uid, 10)) {
						var icon = createUserIcon(data.users[i].uid, data.users[i].picture, data.users[i].userslug, data.users[i].username);
						activeEl.prepend(icon);
						data.users.splice(i, 1);
						break;
					}
				}
				// add other users
				for(i=0; i<data.users.length; ++i) {
					icon = createUserIcon(data.users[i].uid, data.users[i].picture, data.users[i].userslug, data.users[i].username)
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
					if(remainingUsers && anonymousCount)
						title = remainingUsers + ' more user(s) and ' + anonymousCount + ' guest(s)';
					else if(remainingUsers)
						title = remainingUsers + ' more user(s)';
					else
						title = anonymousCount + ' guest(s)';

					anonLink.tooltip({
						placement: 'top',
						title: title
					});
				}

				// Get users who are currently replying to the topic entered
				socket.emit('modules.composer.getUsersByTid', templates.get('topic_id'), function(err, uids) {
					var	activeUsersEl = $('.thread_active_users'),
						x;
					if (uids && uids.length) {
						for(var x=0;x<uids.length;x++) {
							activeUsersEl.find('[data-uid="' + uids[x] + '"]').addClass('replying');
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
			if(config.usePagination) {
				onNewPostPagination(data);
				return;
			}

			var posts = data.posts;
			for (var p in posts) {
				if (posts.hasOwnProperty(p)) {
					var post = posts[p],
						postcount = $('.user_postcount_' + post.uid),
						ptotal = parseInt(postcount.html(), 10);

					ptotal += 1;
					postcount.html(ptotal);
				}
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
				var post = $('li[data-pid="' + data.pid + '"]'),
					upvote = post.find('.upvote');

				upvote.addClass('btn-primary upvoted');
			}
		});

		socket.on('posts.downvote', function(data) {
			if (data && data.pid) {
				var post = $('li[data-pid="' + data.pid + '"]'),
					downvote = post.find('.downvote');

				downvote.addClass('btn-primary downvoted');
			}
		});

		socket.on('posts.unvote', function(data) {
			if (data && data.pid) {
				var post = $('li[data-pid="' + data.pid + '"]'),
					upvote = post.find('.upvote'),
					downvote = post.find('.downvote');

				upvote.removeClass('btn-primary upvoted');
				downvote.removeClass('btn-primary downvoted');
			}
		});

		socket.on('posts.favourite', function(data) {
			if (data && data.pid) {
				var favBtn = $('li[data-pid="' + data.pid + '"] .favourite');
				if(favBtn.length) {
					favBtn.addClass('btn-warning')
						.attr('data-favourited', true);

					var icon = favBtn.find('i');
					var className = icon.attr('class');
					if (className.indexOf('-o') !== -1) {
						icon.attr('class', className.replace('-o', ''));
					}
				}
			}
		});

		socket.on('posts.unfavourite', function(data) {
			if (data && data.pid) {
				var favBtn = $('li[data-pid="' + data.pid + '"] .favourite');
				if(favBtn.length) {
					favBtn.removeClass('btn-warning')
						.attr('data-favourited', false);
					var icon = favBtn.find('i');
					var className = icon.attr('class');
					if (className.indexOf('-o') === -1) {
						icon.attr('class', className + '-o');
					}
				}
			}
		});

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
		};

		function adjust_favourites(value, pid, uid) {
			var favourites = $('li[data-pid="' + pid + '"] .favouriteCount'),
				currentFavourites = parseInt(favourites.attr('data-favourites'), 10);

			currentFavourites += value;

			favourites.html(currentFavourites).attr('data-favourites', currentFavourites);
		};

		function set_follow_state(state, alert) {

			$('.posts .follow').toggleClass('btn-success', state).attr('title', state ? 'You are currently receiving updates to this topic' : 'Be notified of new replies in this topic');

			if(alert) {
				app.alert({
					alert_id: 'topic_follow',
					timeout: 2500,
					title: state ? '[[topic:following_topic.title]]' : '[[topic:not_following_topic.title]]',
					message: state ? '[[topic:following_topic.message]]' : '[[topic:not_following_topic.message]]',
					type: 'success'
				});
			}
		};

		function set_locked_state(locked, alert) {
			translator.translate('<i class="fa fa-fw fa-' + (locked ? 'un': '') + 'lock"></i> [[topic:thread_tools.' + (locked ? 'un': '') + 'lock]]', function(translated) {
				$('.lock_thread').html(translated);
			});

			$('.topic-main-buttons .post_reply').attr('disabled', locked).html(locked ? 'Locked <i class="fa fa-lock"></i>' : 'Reply');

			$('#post-container .post_reply').html(locked ? 'Locked <i class="fa fa-lock"></i>' : 'Reply <i class="fa fa-reply"></i>');
			$('#post-container').find('.quote, .edit, .delete').toggleClass('none', locked);

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
		};

		function set_delete_state(deleted) {
			var threadEl = $('#post-container');

			translator.translate('<i class="fa fa-fw ' + (deleted ? 'fa-comment' : 'fa-trash-o') + '"></i> [[topic:thread_tools.' + (deleted ? 'restore' : 'delete') + ']]', function(translated) {
				$('.delete_thread span').html(translated);
			});

			threadEl.toggleClass('deleted', deleted);
			thread_state.deleted = deleted ? '1' : '0';

			if(deleted) {
				$('<div id="thread-deleted" class="alert alert-warning">This thread has been deleted. Only users with thread management privileges can see it.</div>').insertBefore(threadEl);
			} else {
				$('#thread-deleted').remove();
			}
		};

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
		};

		function toggle_post_delete_state(pid) {
			var postEl = $('#post-container li[data-pid="' + pid + '"]');

			if (postEl.length) {
				postEl.toggleClass('deleted');

				toggle_post_tools(pid, postEl.hasClass('deleted'));

				updatePostCount();
			}
		};

		function toggle_post_tools(pid, isDeleted) {
			var postEl = $('#post-container li[data-pid="' + pid + '"]');

			postEl.find('.quote, .favourite, .post_reply, .chat').toggleClass('none', isDeleted);

			translator.translate(isDeleted ? ' [[topic:restore]]' : ' [[topic:delete]]', function(translated) {
				postEl.find('.delete').find('span').html(translated);
			});
		};

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
			$('#header-topic-title').text(templates.get('topic_name')).show();
		} else {
			$('#header-topic-title').text('').hide();
		}

		$($('.posts > .post-row').get().reverse()).each(function() {
			var el = $(this);

			if (elementInView(el)) {
				var index = parseInt(el.attr('data-index'), 10) + 1;
				if(index > Topic.postCount) {
					index = Topic.postCount;
				}

				$('#pagination').html(index + ' out of ' + Topic.postCount);
				$('.progress-bar').width((index / Topic.postCount * 100) + '%');

				var currentBookmark = localStorage.getItem('topic:' + templates.get('topic_id') + ':bookmark');
				if (!currentBookmark || parseInt(el.attr('data-pid'), 10) > parseInt(currentBookmark, 10)) {
					localStorage.setItem('topic:' + templates.get('topic_id') + ':bookmark', el.attr('data-pid'));
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
					if (highlight) {
						scrollTo.parent().find('.topic-item').addClass('highlight');
						setTimeout(function() {
							scrollTo.parent().find('.topic-item').removeClass('highlight');
						}, 5000);
					}
				});
			}

			if (tid && scrollTo.length) {
				if($('#post-container li.post-row[data-pid="' + pid + '"]').attr('data-index') !== '0') {
					animateScroll();
				} else {
					updateHeader();
				}
			}
		}
	};

	function onNewPostPagination(data) {
		var posts = data.posts;
		socket.emit('topics.getPageCount', templates.get('topic_id'), function(err, newPageCount) {

			pagination.recreatePaginationLinks(newPageCount);

			if(pagination.currentPage === pagination.pageCount) {
				createNewPosts(data);
			} else if(data.posts && data.posts.length && parseInt(data.posts[0].uid, 10) === parseInt(app.uid, 10)) {
				pagination.loadPage(pagination.pageCount);
			}
		});
	}

	function createNewPosts(data, infiniteLoaded, callback) {
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

		parseAndTranslatePosts(data, function(translatedHTML) {
			var translated = $(translatedHTML);

			if(!infiniteLoaded) {
				translated.removeClass('infiniteloaded');
			}

			if(after) {
				translated.insertAfter(after)
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
		var html = templates.prepare(templates['topic'].blocks['posts']).parse(data);
		translator.translate(html, callback);
	}


	function onNewPostsLoaded(html, posts) {
		for (var x = 0, numPosts = posts.length; x < numPosts; x++) {
			socket.emit('posts.getPrivileges', posts[x].pid, function(err, privileges) {
				if(err) {
					return app.alertError(err.message);
				}
				toggle_mod_tools(privileges.pid, privileges.editable);
			});
		}

		infiniteLoaderActive = false;

		app.populateOnlineUsers();
		app.createUserTooltips();
		app.addCommasToNumbers();
		app.makeNumbersHumanReadable($('.human-readable-number'));
		html.find('span.timeago').timeago();
		html.find('.post-content img').addClass('img-responsive');
		updatePostCount();
		showBottomPostBar();
	}


	function toggle_mod_tools(pid, editable) {
		$('#post-container li[data-pid="' + pid + '"]').find('.edit, .delete').toggleClass('none', !editable);
	}

	function updatePostCount() {
		socket.emit('topics.postcount', templates.get('topic_id'), function(err, postcount) {
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
			infiniteLoaderActive = false;
			indicatorEl.fadeOut();
			if(err) {
				return app.alertError(err.message);
			}

			if (data && data.posts && data.posts.length) {
				createNewPosts(data, true, callback);
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