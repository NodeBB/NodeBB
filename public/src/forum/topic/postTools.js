'use strict';

/* globals define, app, translator, ajaxify, socket, bootbox */

define(['composer', 'share'], function(composer, share) {

	var PostTools = {},
		topicName;

	PostTools.init = function(tid, threadState) {
		topicName = ajaxify.variables.get('topic_name');

		addPostHandlers(tid, threadState);

		share.addShareHandlers(topicName);
	};

	function addPostHandlers(tid, threadState) {
		$('.topic').on('click', '.post_reply', function() {
			if (threadState.locked !== '1') {
				onReplyClicked($(this), tid, topicName);
			}
		});

		var postContainer = $('#post-container');

		postContainer.on('click', '.quote', function() {
			if (threadState.locked !== '1') {
				onQuoteClicked($(this), tid, topicName);
			}
		});

		postContainer.on('click', '.favourite', function() {
			favouritePost($(this), getPid($(this)));
		});

		postContainer.on('click', '.upvote', function() {
			return toggleVote($(this), '.upvoted', 'posts.upvote');
		});

		postContainer.on('click', '.downvote', function() {
			return toggleVote($(this), '.downvoted', 'posts.downvote');
		});

		postContainer.on('click', '.flag', function() {
			flagPost(getPid($(this)));
		});

		postContainer.on('click', '.edit', function(e) {
			composer.editPost(getPid($(this)));
		});

		postContainer.on('click', '.delete', function(e) {
			deletePost($(this), tid);
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

		if (selectionText.length) {
			composer.addQuote(tid, getPid(button), topicName, username, selectionText);
		} else {
			composer.newReply(tid, getPid(button), topicName, username ? username + ' ' : '');
		}

	}

	function onQuoteClicked(button, tid, topicName) {
		var username = getUserName(button),
			pid = getPid(button);

		socket.emit('posts.getRawPost', pid, function(err, post) {
			if(err) {
				return app.alertError(err.message);
			}
			var quoted = '';
			if(post) {
				quoted = '> ' + post.replace(/\n/g, '\n> ') + '\n\n';
			}

			if($('.composer').length) {
				composer.addQuote(tid, pid, topicName, username, quoted);
			} else {
				composer.newReply(tid, pid, topicName, username + ' said:\n' + quoted);
			}
		});
	}

	function favouritePost(button, pid) {
		var method = button.attr('data-favourited') === 'false' ? 'posts.favourite' : 'posts.unfavourite';

		socket.emit(method, {
			pid: pid,
			room_id: app.currentRoom
		});

		return false;
	}

	function toggleVote(button, className, method) {
		var post = button.parents('.post-row'),
			currentState = post.find(className).length;

		socket.emit(currentState ? 'posts.unvote' : method , {
			pid: post.attr('data-pid'),
			room_id: app.currentRoom
		});

		return false;
	}

	function getPid(button) {
		return button.parents('.post-row').attr('data-pid');
	}

	function getUserName(button) {
		var username = '',
			post = button.parents('li[data-pid]');

		if (post.length) {
			username = '@' + post.attr('data-username').replace(/\s/g, '-');
		}
		return username;
	}

	function deletePost(button, tid) {
		var pid = getPid(button),
			postEl = $(document.querySelector('#post-container li[data-pid="' + pid + '"]')),
			action = !postEl.hasClass('deleted') ? 'delete' : 'restore';

		translator.translate('[[topic:post_' + action + '_confirm]]', function(msg) {
			bootbox.confirm(msg, function(confirm) {
				if (confirm) {
					socket.emit('posts.' + action, {
						pid: pid,
						tid: tid
					}, function(err) {
						if(err) {
							return translator.translate('[[topic:post_' + action + '_error]]', app.alertError);
						}
					});
				}
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
			movePost(button.parents('.post-row'), getPid(button), topicId.val());
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

			app.alertSuccess('Post moved!');
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
						translator.translate('[[topic:flag_success]]', function(message) {
							app.alertSuccess(message);
						});
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