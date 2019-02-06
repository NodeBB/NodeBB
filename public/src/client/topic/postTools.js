'use strict';


define('forum/topic/postTools', [
	'share',
	'navigator',
	'components',
	'translator',
	'forum/topic/votes',
], function (share, navigator, components, translator, votes) {
	var PostTools = {};

	var staleReplyAnyway = false;

	PostTools.init = function (tid) {
		staleReplyAnyway = false;

		renderMenu();

		addPostHandlers(tid);

		share.addShareHandlers(ajaxify.data.titleRaw);

		votes.addVoteHandler();

		PostTools.updatePostCount(ajaxify.data.postcount);
	};

	function renderMenu() {
		$('[component="topic"]').on('show.bs.dropdown', '.moderator-tools', function () {
			var $this = $(this);
			var dropdownMenu = $this.find('.dropdown-menu');
			if (dropdownMenu.html()) {
				return;
			}
			var postEl = $this.parents('[data-pid]');
			var pid = postEl.attr('data-pid');
			var index = parseInt(postEl.attr('data-index'), 10);

			socket.emit('posts.loadPostTools', { pid: pid, cid: ajaxify.data.cid }, function (err, data) {
				if (err) {
					return app.alertError(err.message);
				}
				data.posts.display_move_tools = data.posts.display_move_tools && index !== 0;

				app.parseAndTranslate('partials/topic/post-menu-list', data, function (html) {
					dropdownMenu.html(html);
					require(['clipboard'], function (clipboard) {
						new clipboard('[data-clipboard-text]');
					});
					$(window).trigger('action:post.tools.load');
				});
			});
		});
	}

	PostTools.toggle = function (pid, isDeleted) {
		var postEl = components.get('post', 'pid', pid);

		postEl.find('[component="post/quote"], [component="post/bookmark"], [component="post/reply"], [component="post/flag"], [component="user/chat"]')
			.toggleClass('hidden', isDeleted);

		postEl.find('[component="post/delete"]').toggleClass('hidden', isDeleted).parent().attr('hidden', isDeleted ? '' : null);
		postEl.find('[component="post/restore"]').toggleClass('hidden', !isDeleted).parent().attr('hidden', !isDeleted ? '' : null);
		postEl.find('[component="post/purge"]').toggleClass('hidden', !isDeleted).parent().attr('hidden', !isDeleted ? '' : null);

		PostTools.removeMenu(postEl);
	};

	PostTools.removeMenu = function (postEl) {
		postEl.find('[component="post/tools"] .dropdown-menu').html('');
	};

	PostTools.updatePostCount = function (postCount) {
		var postCountEl = components.get('topic/post-count');
		postCountEl.html(postCount).attr('title', postCount);
		utils.makeNumbersHumanReadable(postCountEl);
		navigator.setCount(postCount);
	};

	function addPostHandlers(tid) {
		var postContainer = components.get('topic');

		postContainer.on('click', '[component="post/quote"]', function () {
			onQuoteClicked($(this), tid);
		});

		postContainer.on('click', '[component="post/reply"]', function () {
			onReplyClicked($(this), tid);
		});

		$('.topic').on('click', '[component="topic/reply"]', function (e) {
			e.preventDefault();
			onReplyClicked($(this), tid);
		});

		$('.topic').on('click', '[component="topic/reply-as-topic"]', function () {
			translator.translate('[[topic:link_back, ' + ajaxify.data.titleRaw + ', ' + config.relative_path + '/topic/' + ajaxify.data.slug + ']]', function (body) {
				$(window).trigger('action:composer.topic.new', {
					cid: ajaxify.data.cid,
					body: body,
				});
			});
		});

		postContainer.on('click', '[component="post/bookmark"]', function () {
			return bookmarkPost($(this), getData($(this), 'data-pid'));
		});

		postContainer.on('click', '[component="post/upvote"]', function () {
			return votes.toggleVote($(this), '.upvoted', 'posts.upvote');
		});

		postContainer.on('click', '[component="post/downvote"]', function () {
			return votes.toggleVote($(this), '.downvoted', 'posts.downvote');
		});

		postContainer.on('click', '[component="post/vote-count"]', function () {
			votes.showVotes(getData($(this), 'data-pid'));
		});

		postContainer.on('click', '[component="post/flag"]', function () {
			var pid = getData($(this), 'data-pid');
			require(['flags'], function (flags) {
				flags.showFlagModal({
					type: 'post',
					id: pid,
				});
			});
		});

		postContainer.on('click', '[component="post/edit"]', function () {
			var btn = $(this);

			var timestamp = parseInt(getData(btn, 'data-timestamp'), 10);
			var postEditDuration = parseInt(ajaxify.data.postEditDuration, 10);

			if (checkDuration(postEditDuration, timestamp, 'post-edit-duration-expired')) {
				$(window).trigger('action:composer.post.edit', {
					pid: getData(btn, 'data-pid'),
				});
			}
		});

		if (config.enablePostHistory && ajaxify.data.privileges['posts:history']) {
			postContainer.on('click', '[component="post/view-history"], [component="post/edit-indicator"]', function () {
				var btn = $(this);
				require(['forum/topic/diffs'], function (diffs) {
					diffs.open(getData(btn, 'data-pid'));
				});
			});
		}

		postContainer.on('click', '[component="post/delete"]', function () {
			var btn = $(this);
			var timestamp = parseInt(getData(btn, 'data-timestamp'), 10);
			var postDeleteDuration = parseInt(ajaxify.data.postDeleteDuration, 10);
			if (checkDuration(postDeleteDuration, timestamp, 'post-delete-duration-expired')) {
				togglePostDelete($(this), tid);
			}
		});

		function checkDuration(duration, postTimestamp, languageKey) {
			if (!ajaxify.data.privileges.isAdminOrMod && duration && Date.now() - postTimestamp > duration * 1000) {
				var numDays = Math.floor(duration / 86400);
				var numHours = Math.floor((duration % 86400) / 3600);
				var numMinutes = Math.floor(((duration % 86400) % 3600) / 60);
				var numSeconds = ((duration % 86400) % 3600) % 60;
				var msg = '[[error:' + languageKey + ', ' + duration + ']]';
				if (numDays) {
					if (numHours) {
						msg = '[[error:' + languageKey + '-days-hours, ' + numDays + ', ' + numHours + ']]';
					} else {
						msg = '[[error:' + languageKey + '-days, ' + numDays + ']]';
					}
				} else if (numHours) {
					if (numMinutes) {
						msg = '[[error:' + languageKey + '-hours-minutes, ' + numHours + ', ' + numMinutes + ']]';
					} else {
						msg = '[[error:' + languageKey + '-hours, ' + numHours + ']]';
					}
				} else if (numMinutes) {
					if (numSeconds) {
						msg = '[[error:' + languageKey + '-minutes-seconds, ' + numMinutes + ', ' + numSeconds + ']]';
					} else {
						msg = '[[error:' + languageKey + '-minutes, ' + numMinutes + ']]';
					}
				}
				app.alertError(msg);
				return false;
			}
			return true;
		}

		postContainer.on('click', '[component="post/restore"]', function () {
			togglePostDelete($(this), tid);
		});

		postContainer.on('click', '[component="post/purge"]', function () {
			purgePost($(this), tid);
		});

		postContainer.on('click', '[component="post/move"]', function () {
			var btn = $(this);
			require(['forum/topic/move-post'], function (movePost) {
				movePost.init(btn.parents('[data-pid]'));
			});
		});

		postContainer.on('click', '[component="post/ban-ip"]', function () {
			var ip = $(this).attr('data-ip');
			socket.emit('blacklist.addRule', ip, function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alertSuccess('[[admin/manage/blacklist:ban-ip]]');
			});
		});

		postContainer.on('click', '[component="post/chat"]', function () {
			openChat($(this));
		});
	}

	function onReplyClicked(button, tid) {
		var selectedNode = getSelectedNode();

		showStaleWarning(function () {
			var username = getUserSlug(button);
			if (getData(button, 'data-uid') === '0' || !getData(button, 'data-userslug')) {
				username = '';
			}

			var toPid = button.is('[component="post/reply"]') ? getData(button, 'data-pid') : null;

			if (selectedNode.text && (!toPid || !selectedNode.pid || toPid === selectedNode.pid)) {
				username = username || selectedNode.username;
				$(window).trigger('action:composer.addQuote', {
					tid: tid,
					pid: toPid,
					topicName: ajaxify.data.titleRaw,
					username: username,
					text: selectedNode.text,
					selectedPid: selectedNode.pid,
				});
			} else {
				$(window).trigger('action:composer.post.new', {
					tid: tid,
					pid: toPid,
					topicName: ajaxify.data.titleRaw,
					text: username ? username + ' ' : ($('[component="topic/quickreply/text"]').val() || ''),
				});
			}
		});
	}

	function onQuoteClicked(button, tid) {
		var selectedNode = getSelectedNode();

		showStaleWarning(function () {
			var username = getUserSlug(button);
			var toPid = getData(button, 'data-pid');

			function quote(text) {
				$(window).trigger('action:composer.addQuote', {
					tid: tid,
					pid: toPid,
					username: username,
					topicName: ajaxify.data.titleRaw,
					text: text,
				});
			}

			if (selectedNode.text && toPid && toPid === selectedNode.pid) {
				return quote(selectedNode.text);
			}
			socket.emit('posts.getRawPost', toPid, function (err, post) {
				if (err) {
					return app.alertError(err.message);
				}

				quote(post);
			});
		});
	}

	function getSelectedNode() {
		var selectedText = '';
		var selectedPid;
		var username = '';
		var selection = window.getSelection ? window.getSelection() : document.selection.createRange();
		var postContents = $('[component="post"] [component="post/content"]');
		var content;
		postContents.each(function (index, el) {
			if (selection && selection.containsNode && el && selection.containsNode(el, true)) {
				content = el;
			}
		});

		if (content) {
			var bounds = document.createRange();
			bounds.selectNodeContents(content);
			var range = selection.getRangeAt(0).cloneRange();
			if (range.compareBoundaryPoints(Range.START_TO_START, bounds) < 0) {
				range.setStart(bounds.startContainer, bounds.startOffset);
			}
			if (range.compareBoundaryPoints(Range.END_TO_END, bounds) > 0) {
				range.setEnd(bounds.endContainer, bounds.endOffset);
			}
			bounds.detach();
			selectedText = range.toString();
			var postEl = $(content).parents('[component="post"]');
			selectedPid = postEl.attr('data-pid');
			username = getUserSlug($(content));
			range.detach();
		}
		return { text: selectedText, pid: selectedPid, username: username };
	}

	function bookmarkPost(button, pid) {
		var method = button.attr('data-bookmarked') === 'false' ? 'posts.bookmark' : 'posts.unbookmark';

		socket.emit(method, {
			pid: pid,
			room_id: 'topic_' + ajaxify.data.tid,
		}, function (err) {
			if (err) {
				app.alertError(err.message);
			}
		});

		return false;
	}

	function getData(button, data) {
		return button.parents('[data-pid]').attr(data);
	}

	function getUserSlug(button) {
		var slug = '';
		var post = button.parents('[data-pid]');

		if (button.attr('component') === 'topic/reply') {
			return slug;
		}

		if (post.length) {
			slug = utils.slugify(post.attr('data-username'), true);
		}
		if (post.length && post.attr('data-uid') !== '0') {
			slug = '@' + slug;
		}

		return slug;
	}

	function togglePostDelete(button, tid) {
		var pid = getData(button, 'data-pid');
		var postEl = components.get('post', 'pid', pid);
		var action = !postEl.hasClass('deleted') ? 'delete' : 'restore';

		postAction(action, pid, tid);
	}

	function purgePost(button, tid) {
		postAction('purge', getData(button, 'data-pid'), tid);
	}

	function postAction(action, pid, tid) {
		translator.translate('[[topic:post_' + action + '_confirm]]', function (msg) {
			bootbox.confirm(msg, function (confirm) {
				if (!confirm) {
					return;
				}

				socket.emit('posts.' + action, {
					pid: pid,
					tid: tid,
				}, function (err) {
					if (err) {
						app.alertError(err.message);
					}
				});
			});
		});
	}

	function openChat(button) {
		var post = button.parents('[data-pid]');

		app.newChat(post.attr('data-uid'));
		button.parents('.btn-group').find('.dropdown-toggle').click();
		return false;
	}

	function showStaleWarning(callback) {
		var staleThreshold = Math.min(Date.now() - (1000 * 60 * 60 * 24 * ajaxify.data.topicStaleDays), 8640000000000000);
		if (staleReplyAnyway || ajaxify.data.lastposttime >= staleThreshold) {
			return callback();
		}

		translator.translate('[[topic:stale.warning]]', function (translated) {
			var warning = bootbox.dialog({
				title: '[[topic:stale.title]]',
				message: translated,
				buttons: {
					reply: {
						label: '[[topic:stale.reply_anyway]]',
						className: 'btn-link',
						callback: function () {
							staleReplyAnyway = true;
							callback();
						},
					},
					create: {
						label: '[[topic:stale.create]]',
						className: 'btn-primary',
						callback: function () {
							translator.translate('[[topic:link_back, ' + ajaxify.data.title + ', ' + config.relative_path + '/topic/' + ajaxify.data.slug + ']]', function (body) {
								$(window).trigger('action:composer.topic.new', {
									cid: ajaxify.data.cid,
									body: body,
								});
							});
						},
					},
				},
			});

			warning.modal();
		});
	}

	return PostTools;
});
