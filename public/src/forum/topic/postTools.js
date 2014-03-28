'use strict';

/* globals define, app, translator, ajaxify, socket, bootbox */

define(['composer'], function(composer) {

	var PostTools = {},
		topicName;

	PostTools.init = function(tid, threadState) {
		topicName = ajaxify.variables.get('topic_name');

		addPostHandlers(tid, threadState);

		addShareHandlers();
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
			if (snippet.length > 0) {
				selectionText = '> ' + snippet.replace(/\n/g, '\n> ');
			}
		}

		var username = getUserName(button);
		username += username ? ' ' : '';

		composer.newReply(tid, getPid(button), topicName, selectionText.length > 0 ? selectionText + '\n\n' + username : '' + username);
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
		bootbox.confirm('Are you sure you want to flag this post?', function(confirm) {
			if (confirm) {
				socket.emit('posts.flag', pid, function(err) {
					if(err) {
						return app.alertError(err.message);
					}
					app.alertSuccess('This post has been flagged for moderation.');
				});
			}
		});
	}

	function openChat(button) {
		var post = button.parents('li.post-row');

		app.openChat(post.attr('data-username'), post.attr('data-uid'));
		button.parents('.btn-group').find('.dropdown-toggle').click();
		return false;
	}

	function addShareHandlers() {

		function openShare(url, pid, width, height) {
			window.open(url + encodeURIComponent(window.location.protocol + '//' + window.location.host + window.location.pathname + '#' + pid), '_blank', 'width=' + width + ',height=' + height + ',scrollbars=no,status=no');
			return false;
		}

		$('#post-container').on('shown.bs.dropdown', '.share-dropdown', function() {
			var pid = getPid($(this));
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
			return openShare('https://twitter.com/intent/tweet?text=' + topicName + '&url=', getPid($(this)), 550, 420);
		});

		$('#post-container').on('click', '.facebook-share', function () {
			return openShare('https://www.facebook.com/sharer/sharer.php?u=', getPid($(this)), 626, 436);
		});

		$('#post-container').on('click', '.google-share', function () {
			return openShare('https://plus.google.com/share?url=', getPid($(this)), 500, 570);
		});
	}

	return PostTools;
});