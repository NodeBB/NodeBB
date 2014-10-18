'use strict';

/* globals define, app, translator, ajaxify, socket, bootbox */

define('forum/topic/postTools', ['composer', 'share', 'navigator'], function(composer, share, navigator) {

	var PostTools = {},
		topicName;

	PostTools.init = function(tid, threadState) {
		topicName = ajaxify.variables.get('topic_name');

		addPostHandlers(tid, threadState);

		share.addShareHandlers(topicName);

		addVoteHandler();
	};

	PostTools.toggle = function(pid, isDeleted) {
		var postEl = $('#post-container li[data-pid="' + pid + '"]');

		postEl.find('.quote, .favourite, .post_reply, .chat').toggleClass('hidden', isDeleted);
		postEl.find('.purge').toggleClass('hidden', !isDeleted);
		postEl.find('.delete .i').toggleClass('fa-trash-o', !isDeleted).toggleClass('fa-history', isDeleted);
		postEl.find('.delete span').translateHtml(isDeleted ? ' [[topic:restore]]' : ' [[topic:delete]]');
	};

	PostTools.updatePostCount = function() {
		socket.emit('topics.postcount', ajaxify.variables.get('topic_id'), function(err, postCount) {
			if (!err) {
				$('.topic-post-count').html(postCount);
				navigator.setCount(postCount);
			}
		});
	};

	function addVoteHandler() {
		$('#post-container').on('mouseenter', '.post-row .votes', function() {
			loadDataAndCreateTooltip($(this), 'posts.getUpvoters');
		});
	}

	function loadDataAndCreateTooltip(el, method) {
		var pid = el.parents('.post-row').attr('data-pid');
		socket.emit(method, pid, function(err, data) {
			if (!err) {
				createTooltip(el, data);
			}
		});
	}

	function createTooltip(el, data) {
		var usernames = data.usernames;
		if (!usernames.length) {
			return;
		}
		if (usernames.length + data.otherCount > 6) {
			usernames = usernames.join(', ').replace(/,/g, '|');
			translator.translate('[[topic:users_and_others, ' + usernames + ', ' + data.otherCount + ']]', function(translated) {
				translated = translated.replace(/\|/g, ',');
				el.attr('title', translated).tooltip('destroy').tooltip('show');
			});
		} else {
			usernames = usernames.join(', ');
			el.attr('title', usernames).tooltip('destroy').tooltip('show');
		}
	}

	function addPostHandlers(tid, threadState) {
		$('.topic').on('click', '.post_reply', function() {
			if (!threadState.locked) {
				onReplyClicked($(this), tid, topicName);
			}
		});

		var postContainer = $('#post-container');

		postContainer.on('click', '.quote', function() {
			if (!threadState.locked) {
				onQuoteClicked($(this), tid, topicName);
			}
		});

		postContainer.on('click', '.favourite', function() {
			favouritePost($(this), getData($(this), 'data-pid'));
		});

		postContainer.on('click', '.upvote', function() {
			return toggleVote($(this), '.upvoted', 'posts.upvote');
		});

		postContainer.on('click', '.downvote', function() {
			return toggleVote($(this), '.downvoted', 'posts.downvote');
		});

		postContainer.on('click', '.flag', function() {
			flagPost(getData($(this), 'data-pid'));
		});

		postContainer.on('click', '.edit', function(e) {
			composer.editPost(getData($(this), 'data-pid'));
		});

		postContainer.on('click', '.delete', function(e) {
			deletePost($(this), tid);
		});

		postContainer.on('click', '.purge', function(e) {
			purgePost($(this), tid);
		});

		postContainer.on('click', '.move', function(e) {
			openMovePostModal($(this));
		});

		postContainer.on('click', '.chat', function(e) {
			openChat($(this));
		});
	}

	function onReplyClicked(button, tid, topicName) {
		var selectionText = '',
			selection = window.getSelection ? window.getSelection() : document.selection.createRange();

		if ($(selection.baseNode).parents('.post-content').length > 0) {
			var snippet = selection.toString();
			if (snippet.length) {
				selectionText = '> ' + snippet.replace(/\n/g, '\n> ') + '\n\n';
			}
		}

		var username = getUserName(selectionText ? $(selection.baseNode) : button);
		if (getData(button, 'data-uid') === '0') {
			username = '';
		}
		if (selectionText.length) {
			composer.addQuote(tid, ajaxify.variables.get('topic_slug'), getData(button, 'data-index'), getData(button, 'data-pid'), topicName, username, selectionText);
		} else {
			composer.newReply(tid, getData(button, 'data-pid'), topicName, username ? username + ' ' : '');
		}

	}

	function onQuoteClicked(button, tid, topicName) {
		var username = getUserName(button),
			pid = getData(button, 'data-pid');

		socket.emit('posts.getRawPost', pid, function(err, post) {
			if(err) {
				return app.alertError(err.message);
			}
			var quoted = '';
			if(post) {
				quoted = '> ' + post.replace(/\n/g, '\n> ') + '\n\n';
			}

			if($('.composer').length) {
				composer.addQuote(tid, ajaxify.variables.get('topic_slug'), getData(button, 'data-index'), pid, topicName, username, quoted);
			} else {
				composer.newReply(tid, pid, topicName, '[[modules:composer.user_said, ' + username + ']]\n' + quoted);
			}
		});
	}

	function favouritePost(button, pid) {
		var method = button.attr('data-favourited') === 'false' ? 'posts.favourite' : 'posts.unfavourite';

		socket.emit(method, {
			pid: pid,
			room_id: app.currentRoom
		}, function(err) {
			if (err) {
				app.alertError(err.message);
			}
		});

		return false;
	}

	function toggleVote(button, className, method) {
		var post = button.parents('.post-row'),
			currentState = post.find(className).length;

		socket.emit(currentState ? 'posts.unvote' : method , {
			pid: post.attr('data-pid'),
			room_id: app.currentRoom
		}, function(err) {
			if (err) {
				app.alertError(err.message);
			}
		});

		return false;
	}

	function getData(button, data) {
		return button.parents('.post-row').attr(data);
	}

	function getUserName(button) {
		var username = '',
			post = button.parents('li[data-pid]');

		if (post.length) {
			username = post.attr('data-username').replace(/\s/g, '-');
		}
		if (post.length && post.attr('data-uid') !== '0') {
			username = '@' + username;
		}

		return username;
	}

	function deletePost(button, tid) {
		var pid = getData(button, 'data-pid'),
			postEl = $('#post-container li[data-pid="' + pid + '"]'),
			action = !postEl.hasClass('deleted') ? 'delete' : 'restore';

		postAction(action, pid, tid);
	}

	function purgePost(button, tid) {
		postAction('purge', getData(button, 'data-pid'), tid);
	}

	function postAction(action, pid, tid) {
		translator.translate('[[topic:post_' + action + '_confirm]]', function(msg) {
			bootbox.confirm(msg, function(confirm) {
				if (!confirm) {
					return;
				}

				socket.emit('posts.' + action, {
					pid: pid,
					tid: tid
				}, function(err) {
					if(err) {
						app.alertError(err.message);
					}
				});
			});
		});
	}

	function openMovePostModal(button) {
		var moveModal = $('#move-post-modal'),
			moveBtn = moveModal.find('#move_post_commit'),
			topicId = moveModal.find('#topicId');

		showMoveModal();

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
			movePost(button.parents('.post-row'), getData(button, 'data-pid'), topicId.val());
		});
	}

	function showMoveModal() {
		$('#move-post-modal').removeClass('hide')
			.css("position", "fixed")
			.css("left", Math.max(0, (($(window).width() - $($('#move-post-modal')).outerWidth()) / 2) + $(window).scrollLeft()) + "px")
			.css("top", "0px")
			.css("z-index", "2000");
	}

	function movePost(post, pid, tid) {
		socket.emit('topics.movePost', {pid: pid, tid: tid}, function(err) {
			$('#move-post-modal').addClass('hide');

			if(err) {
				$('#topicId').val('');
				return app.alertError(err.message);
			}

			post.fadeOut(500, function() {
				post.remove();
			});

			$('#topicId').val('');

			app.alertSuccess('[[topic:post_moved]]');
		});
	}

	function flagPost(pid) {
		translator.translate('[[topic:flag_confirm]]', function(message) {
			bootbox.confirm(message, function(confirm) {
				if (confirm) {
					socket.emit('posts.flag', pid, function(err) {
						if(err) {
							return app.alertError(err.message);
						}

						app.alertSuccess('[[topic:flag_success]]');
					});
				}
			});
		});
	}

	function openChat(button) {
		var post = button.parents('li.post-row');

		app.openChat(post.attr('data-username'), post.attr('data-uid'));
		button.parents('.btn-group').find('.dropdown-toggle').click();
		return false;
	}

	return PostTools;
});
