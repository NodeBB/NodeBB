'use strict';

/* globals define, app, translator, templates, socket, bootbox */

define(['composer'], function(composer) {

	var PostTools = {};

	PostTools.init = function(tid, threadState) {

		var topic_name = templates.get('topic_name');

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

			if (threadState.locked !== '1') {
				composer.newReply(tid, pid, topic_name, selectionText.length > 0 ? selectionText + '\n\n' + username : '' + username);
			}
		});

		$('#post-container').on('click', '.quote', function() {
			if (threadState.locked !== '1') {
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

			var method = $(this).attr('data-favourited') === 'false' ? 'posts.favourite' : 'posts.unfavourite';

			socket.emit(method, {
				pid: pid,
				room_id: app.currentRoom
			});

			return false;
		});

		$('#post-container').on('click', '.upvote', function() {
			var post = $(this).parents('.post-row'),
				upvoted = post.find('.upvoted').length;

			socket.emit(upvoted ? 'posts.unvote' : 'posts.upvote' , {
				pid: post.attr('data-pid'),
				room_id: app.currentRoom
			});

			return false;
		});

		$('#post-container').on('click', '.downvote', function() {
			var post = $(this).parents('.post-row'),
				downvoted = post.find('.downvoted').length;

			socket.emit(downvoted ? 'posts.unvote' : 'posts.downvote', {
				pid: post.attr('data-pid'),
				room_id: app.currentRoom
			});

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
			var post = $(this).parents('li.post-row');

			app.openChat(post.attr('data-username'), post.attr('data-uid'));
			$(this).parents('.btn-group').find('.dropdown-toggle').click();
			return false;
		});
	};

	return PostTools;
});