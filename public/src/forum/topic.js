define(['composer', 'forum/pagination'], function(composer, pagination) {
	var	Topic = {},
		infiniteLoaderActive = false;

	function showBottomPostBar() {
		if($('#post-container .post-row').length > 1 || !$('#post-container li[data-index="0"]').length) {
			$('.bottom-post-bar').removeClass('hide');
		}
	}

	$(window).on('action:ajaxifying', function(ev, data) {

		if(data.url.indexOf('topic') === 0) {
			$('.pagination-block a').off('click').on('click', function() {
				return false;
			});

			$('.pagination-block i:first').off('click').on('click', function() {
				app.scrollToTop();
			});

			$('.pagination-block i:last').off('click').on('click', function() {
				app.scrollToBottom();
			});

		} else {
			$('.pagination-block').addClass('hide');
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


		function fixDeleteStateForPosts() {
			var postEls = document.querySelectorAll('#post-container li[data-deleted]');
			for (var x = 0, numPosts = postEls.length; x < numPosts; x++) {
				if (postEls[x].getAttribute('data-deleted') === '1') {
					toggle_post_delete_state(postEls[x].getAttribute('data-pid'));
				}
				postEls[x].removeAttribute('data-deleted');
			}
		}

		jQuery('document').ready(function() {

			app.addCommasToNumbers();

			app.enterRoom('topic_' + tid);

			showBottomPostBar();

			updateHeader();

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
					socket.emit('topics.markAsUnreadForAll', tid, function(err) {
						if(err) {
							return app.alertError(err.message);
						}
					});
					return false;
				})

				moveThreadModal.on('shown.bs.modal', function() {

					var loadingEl = document.getElementById('categories-loading');
					if (loadingEl) {
						socket.emit('categories.get', function(err, data) {
							// Render categories
							var categoriesFrag = document.createDocumentFragment(),
								categoryEl = document.createElement('li'),
								numCategories = data.categories.length,
								modalBody = moveThreadModal.find('.modal-body'),
								categoriesEl = modalBody[0].getElementsByTagName('ul')[0],
								confirmDiv = document.getElementById('move-confirm'),
								confirmCat = confirmDiv.getElementsByTagName('span')[0],
								commitEl = document.getElementById('move_thread_commit'),
								cancelEl = document.getElementById('move_thread_cancel'),
								x, info, targetCid, targetCatLabel;

							categoriesEl.className = 'category-list';
							for (x = 0; x < numCategories; x++) {
								info = data.categories[x];
								categoryEl.style.background = info.bgColor;
								categoryEl.style.color = info.color || '#fff';
								categoryEl.className = info.disabled === '1' ? ' disabled' : '';
								categoryEl.innerHTML = '<i class="fa ' + info.icon + '"></i> ' + info.name;
								categoryEl.setAttribute('data-cid', info.cid);
								categoriesFrag.appendChild(categoryEl.cloneNode(true));
							}
							categoriesEl.appendChild(categoriesFrag);
							modalBody[0].removeChild(loadingEl);

							categoriesEl.addEventListener('click', function(e) {
								if (e.target.nodeName === 'LI') {
									confirmCat.innerHTML = e.target.innerHTML;
									confirmDiv.style.display = 'block';
									targetCid = e.target.getAttribute('data-cid');
									targetCatLabel = e.target.innerHTML;
									commitEl.disabled = false;
								}
							}, false);

							commitEl.addEventListener('click', function() {
								if (!commitEl.disabled && targetCid) {
									commitEl.disabled = true;
									$(cancelEl).fadeOut(250);
									$(moveThreadModal).find('.modal-header button').fadeOut(250);
									commitEl.innerHTML = 'Moving <i class="fa-spin fa-refresh"></i>';

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
					forkModal.css("position", "fixed")
						.css("left", Math.max(0, (($(window).width() - $(forkModal).outerWidth()) / 2) + $(window).scrollLeft()) + "px")
						.css("top", "0px")
						.css("z-index", "2000");

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
							$('#post-container li[data-pid="' + pids[i] + '"]').css('opacity', 1.0);
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


			// Follow Thread State
			var followEl = $('.posts .follow'),
				set_follow_state = function(state, quiet) {
					if (state && !followEl.hasClass('btn-success')) {
						followEl.addClass('btn-success');
						followEl.attr('title', 'You are currently receiving updates to this topic');
						if (!quiet) {
							app.alert({
								alert_id: 'topic_follow',
								timeout: 2500,
								title: 'Following Topic',
								message: 'You will now be receiving notifications when somebody posts to this topic.',
								type: 'success'
							});
						}
					} else if (!state && followEl.hasClass('btn-success')) {
						followEl.removeClass('btn-success');
						followEl.attr('title', 'Be notified of new replies in this topic');
						if (!quiet) {
							app.alert({
								alert_id: 'topic_follow',
								timeout: 2500,
								title: 'Not Following Topic',
								message: 'You will no longer receive notifications from this topic.',
								type: 'success'
							});
						}
					}
				};

			socket.emit('topics.followCheck', tid, function(err, state) {
				set_follow_state(state, true);
			});

			followEl.on('click', function() {
				socket.emit('topics.follow', tid, function(err, state) {
					if(err) {
						return app.alert({
							type: 'danger',
							alert_id: 'topic_follow',
							title: 'Please Log In',
							message: 'Please register or log in in order to subscribe to this topic',
							timeout: 5000
						});
					}

					set_follow_state(state);
				});

				return false;
			});

			enableInfiniteLoading();

			var bookmark = localStorage.getItem('topic:' + tid + ':bookmark');

			if(bookmark) {
				Topic.scrollToPost(parseInt(bookmark, 10));
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
				app.enableInfiniteLoading(function() {
					if (!infiniteLoaderActive && $('#post-container').children().length) {
						loadMorePosts(tid, function(posts) {
							fixDeleteStateForPosts();
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
				selection = window.getSelection() || document.getSelection();

			if ($(selection.baseNode).parents('.post-content').length > 0) {
				var snippet = selection.toString();
				if (snippet.length > 0) {
					selectionText = '> ' + snippet.replace(/\n/g, '\n> ');
				}
			}

			var username = '',
				post = $(this).parents('li[data-pid]');
			if (post.length) {
				username = '@' + post.attr('data-username').replace(/\s/g, '-') + ' ';
			}

			if (thread_state.locked !== '1') {
				composer.newReply(tid, topic_name, selectionText.length > 0 ? selectionText + '\n\n' + username : '' + username);
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
						composer.newReply(tid, topic_name, username + ' said:\n' + quoted);
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
			bootbox.confirm('Are you sure you want to flag this post?', function(confirm) {
				if (confirm) {
					var pid = $(this).parents('.post-row').attr('data-pid');

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
			$('#post_' + pid + '_link').val(window.location.href + "#" + pid);
			// without the setTimeout can't select the text in the input
			setTimeout(function() {
				$('#post_' + pid + '_link').select();
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
			'event:rep_up', 'event:rep_down', 'event:new_post', 'get_users_in_room',
			'event:topic_deleted', 'event:topic_restored', 'event:topic:locked',
			'event:topic_unlocked', 'event:topic_pinned', 'event:topic_unpinned',
			'event:topic_moved', 'event:post_edited', 'event:post_deleted', 'event:post_restored',
			'posts.favourite', 'user.isOnline', 'posts.upvote', 'posts.downvote'
		]);

		socket.on('get_users_in_room', function(data) {

			if(data && data.room.indexOf('topic') !== -1) {
				var activeEl = $('.thread_active_users');

				function createUserIcon(uid, picture, userslug, username) {
					if(!activeEl.find('[href="'+ RELATIVE_PATH +'/user/' + data.users[i].userslug + '"]').length) {
						var userIcon = $('<img src="'+ picture +'"/>');

						var userLink = $('<a href="' + RELATIVE_PATH + '/user/' + userslug + '"></a>').append(userIcon);
						userLink.attr('data-uid', uid);

						var div = $('<div class="inline-block"></div>');
						div.append(userLink);

						userLink.tooltip({
							placement: 'top',
							title: username
						});

						return div;
					}
				}

				// remove users that are no longer here
				activeEl.children().each(function(index, element) {
					if(element) {
						var uid = $(element).attr('data-uid');
						for(var i=0; i<data.users.length; ++i) {
							if(data.users[i].uid == uid) {
								return;
							}
						}
						$(element).remove();
					}
				});

				var i=0;
				// add self
				for(i = 0; i<data.users.length; ++i) {
					if(data.users[i].uid == app.uid) {
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

		socket.on('event:new_post', function(data) {
			if(config.usePagination) {
				onNewPostPagination(data);
				return;
			}

			var posts = data.posts;
			for (var p in posts) {
				if (posts.hasOwnProperty(p)) {
					var post = posts[p],
						postcount = jQuery('.user_postcount_' + post.uid),
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

		function set_locked_state(locked, alert) {
			var threadReplyBtn = $('.topic-main-buttons .post_reply'),
				postReplyBtns = document.querySelectorAll('#post-container .post_reply'),
				quoteBtns = document.querySelectorAll('#post-container .quote'),
				editBtns = document.querySelectorAll('#post-container .edit'),
				deleteBtns = document.querySelectorAll('#post-container .delete'),
				numPosts = document.querySelectorAll('#post_container li[data-pid]').length,
				lockThreadEl = $('.lock_thread'),
				x;

			if (locked === true) {
				lockThreadEl.html('<i class="fa fa-unlock"></i> Unlock Thread');
				threadReplyBtn.attr('disabled', true);
				threadReplyBtn.html('Locked <i class="fa fa-lock"></i>');
				for (x = 0; x < numPosts; x++) {
					postReplyBtns[x].innerHTML = 'Locked <i class="fa fa-lock"></i>';
					quoteBtns[x].style.display = 'none';
					editBtns[x].style.display = 'none';
					deleteBtns[x].style.display = 'none';
				}

				if (alert) {
					app.alert({
						'alert_id': 'thread_lock',
						type: 'success',
						title: 'Thread Locked',
						message: 'Thread has been successfully locked',
						timeout: 5000
					});
				}

				thread_state.locked = '1';
			} else {
				lockThreadEl.html('<i class="fa fa-lock"></i> Lock Thread');
				threadReplyBtn.attr('disabled', false);
				threadReplyBtn.html('Reply');
				for (x = 0; x < numPosts; x++) {
					postReplyBtns[x].innerHTML = 'Reply <i class="fa fa-reply"></i>';
					quoteBtns[x].style.display = 'inline-block';
					editBtns[x].style.display = 'inline-block';
					deleteBtns[x].style.display = 'inline-block';
				}

				if (alert) {
					app.alert({
						'alert_id': 'thread_lock',
						type: 'success',
						title: 'Thread Unlocked',
						message: 'Thread has been successfully unlocked',
						timeout: 5000
					});
				}

				thread_state.locked = '0';
			}
		}

		function set_delete_state(deleted) {
			var deleteThreadEl = $('.delete_thread'),
				deleteTextEl = $('.delete_thread span'),
				//deleteThreadEl.getElementsByTagName('span')[0],
				threadEl = $('#post-container'),
				deleteNotice = document.getElementById('thread-deleted') || document.createElement('div');

			if (deleted) {
				deleteTextEl.html('<i class="fa fa-comment"></i> Restore Thread');
				threadEl.addClass('deleted');

				// Spawn a 'deleted' notice at the top of the page
				deleteNotice.setAttribute('id', 'thread-deleted');
				deleteNotice.className = 'alert alert-warning';
				deleteNotice.innerHTML = 'This thread has been deleted. Only users with thread management privileges can see it.';
				threadEl.before(deleteNotice);

				thread_state.deleted = '1';
			} else {
				deleteTextEl.html('<i class="fa fa-trash-o"></i> Delete Thread');
				threadEl.removeClass('deleted');
				deleteNotice.parentNode.removeChild(deleteNotice);

				thread_state.deleted = '0';
			}
		}

		function set_pinned_state(pinned, alert) {
			var pinEl = $('.pin_thread');

			if (pinned) {
				pinEl.html('<i class="fa fa-thumb-tack"></i> Unpin Thread');
				if (alert) {
					app.alert({
						'alert_id': 'thread_pin',
						type: 'success',
						title: 'Thread Pinned',
						message: 'Thread has been successfully pinned',
						timeout: 5000
					});
				}

				thread_state.pinned = '1';
			} else {
				pinEl.html('<i class="fa fa-thumb-tack"></i> Pin Thread');
				if (alert) {
					app.alert({
						'alert_id': 'thread_pin',
						type: 'success',
						title: 'Thread Unpinned',
						message: 'Thread has been successfully unpinned',
						timeout: 5000
					});
				}

				thread_state.pinned = '0';
			}
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
			var postEl = $('#post-container li[data-pid="' + pid + '"]'),
				quoteEl = $(postEl[0].querySelector('.quote')),
				favEl = $(postEl[0].querySelector('.favourite')),
				replyEl = $(postEl[0].querySelector('.post_reply')),
				chatEl = $(postEl[0].querySelector('.chat'));

			if (isDeleted) {
				quoteEl.addClass('none');
				favEl.addClass('none');
				replyEl.addClass('none');
				chatEl.addClass('none');
			} else {
				quoteEl.removeClass('none');
				favEl.removeClass('none');
				replyEl.removeClass('none');
				chatEl.removeClass('none');
			}
		}

		$(window).on('scroll', updateHeader);
	};

	function updateHeader() {
		var paginationEl = $('#pagination');

		var windowHeight = jQuery(window).height();
		var scrollTop = jQuery(window).scrollTop();
		var scrollBottom = scrollTop + windowHeight;
		var progressBar = $('.progress-bar');
		var tid = templates.get('topic_id');

		if (scrollTop < jQuery('.posts > .post-row:first-child').height() && Topic.postCount > 1) {
			localStorage.removeItem("topic:" + tid + ":bookmark");
			paginationEl.html('1 out of ' + Topic.postCount);
			progressBar.width(0);
			return;
		}


		var count = 0, smallestNonNegative = 0;

		jQuery('.posts > .post-row:not(".deleted")').each(function() {
			count++;
			this.postnumber = count;


			var el = jQuery(this);
			var elTop = el.offset().top;
			var height = Math.floor(el.height());
			var elBottom = elTop + (height < 300 ? height : 300);

			var inView = ((elBottom >= scrollTop) && (elTop <= scrollBottom) && (elBottom <= scrollBottom) && (elTop >= scrollTop));


			if (inView) {
				if(elTop - scrollTop > smallestNonNegative) {
					localStorage.setItem("topic:" + tid + ":bookmark", el.attr('data-pid'));
					smallestNonNegative = Number.MAX_VALUE;
				}

				paginationEl.html((this.postnumber-1) + ' out of ' + Topic.postCount);
				progressBar.width(((this.postnumber-1) / Topic.postCount * 100) + '%');
			}
		});

		setTimeout(function() {
			if (scrollTop + windowHeight == jQuery(document).height() && !infiniteLoaderActive) {
				paginationEl.html(Topic.postCount + ' out of ' + Topic.postCount);
				progressBar.width('100%');
			}
		}, 100);
	}

	Topic.scrollToPost = function(pid) {
		if (!pid) {
			return;
		}

		if(config.usePagination) {
			socket.emit('posts.getPidPage', pid, function(err, page) {
				if(err) {
					return;
				}
				if(parseInt(page, 10) !== pagination.currentPage) {
					pagination.loadPage(page);
				} else {
					scrollToPid(pid);
				}
			});
		} else {
			scrollToPid(pid);
		}

		function scrollToPid(pid) {
			var container = $(window),
			scrollTo = $('#post_anchor_' + pid),
			tid = $('#post-container').attr('data-tid');

			function animateScroll() {
				$('window,html').animate({
					scrollTop: scrollTo.offset().top + container.scrollTop() - $('#header-menu').height()
				}, 400);
			}

			if (!scrollTo.length && tid) {

				var intervalID = setInterval(function () {
					loadMorePosts(tid, function (posts) {
						scrollTo = $('#post_anchor_' + pid);

						if (tid && scrollTo.length) {
							animateScroll();
						}

						if (!posts.length || scrollTo.length)
							clearInterval(intervalID);
					});
				}, 100);

			} else if (tid) {
				animateScroll();
			}
		}
	}

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

	function createNewPosts(data, infiniteLoaded) {
		if(!data || (data.posts && !data.posts.length)) {
			return;
		}

		function removeAlreadyAddedPosts() {
			data.posts = data.posts.filter(function(post) {
				return $('#post-container li[data-pid="' + post.pid +'"]').length === 0;
			});
		}

		function findInsertionPoint() {
			var after = null,
				firstPid = data.posts[0].pid;

			$('#post-container li[data-pid]').each(function() {
				if(parseInt(firstPid, 10) > parseInt($(this).attr('data-pid'), 10)) {
					after = $(this);
					if(after.next().length && after.next().hasClass('post-bar')) {
						after = after.next();
					}
				} else {
					return false;
				}
			});
			return after;
		}

		removeAlreadyAddedPosts();
		if(!data.posts.length) {
			return;
		}

		var insertAfter = findInsertionPoint();

		parseAndTranslatePosts(data, function(translatedHTML) {
			var translated = $(translatedHTML);

			if(!infiniteLoaded) {
				translated.removeClass('infiniteloaded');
			}

			translated.insertAfter(insertAfter)
				.hide()
				.fadeIn('slow');

			onNewPostsLoaded(data.posts);
		});
	}

	function parseAndTranslatePosts(data, callback) {
		var html = templates.prepare(templates['topic'].blocks['posts']).parse(data);
		var regexp = new RegExp("<!--[\\s]*IF @first[\\s]*-->([\\s\\S]*?)<!--[\\s]*ENDIF @first[\\s]*-->", 'g');
		html = html.replace(regexp, '');

		translator.translate(html, callback);
	}


	function onNewPostsLoaded(posts) {
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
		$('span.timeago').timeago();
		$('.post-content img').addClass('img-responsive');
		updatePostCount();
		showBottomPostBar();
	}


	function toggle_mod_tools(pid, state) {
		var postEl = $(document.querySelector('#post-container li[data-pid="' + pid + '"]')),
			editEl = postEl.find('.edit'),
			deleteEl = postEl.find('.delete');

		if (state) {
			editEl.removeClass('none');
			deleteEl.removeClass('none');
		} else {
			editEl.addClass('none');
			deleteEl.addClass('none');
		}
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

	function loadMorePosts(tid, callback) {
		var indicatorEl = $('.loading-indicator');

		if (infiniteLoaderActive) {
			return;
		}

		if (indicatorEl.attr('done') === '0') {
			infiniteLoaderActive = true;
			indicatorEl.fadeIn();

			socket.emit('topics.loadMore', {
				tid: tid,
				after: parseInt($('#post-container .post-row.infiniteloaded').last().attr('data-index'), 10) + 1
			}, function (err, data) {
				if(err) {
					return app.alertError(err.message);
				}

				infiniteLoaderActive = false;
				if (data && data.posts && data.posts.length) {
					indicatorEl.attr('done', '0');
					createNewPosts(data, true);
				} else {
					indicatorEl.attr('done', '1');
					updateHeader();
				}

				indicatorEl.fadeOut();

				if (callback) {
					callback(data.posts);
				}
			});
		}
	}

	return Topic;
});