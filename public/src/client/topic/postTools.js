'use strict';


define('forum/topic/postTools', [
	'share',
	'navigator',
	'components',
	'translator',
	'forum/topic/votes',
	'api',
	'bootbox',
	'alerts',
	'hooks',
	'helpers',
], function (share, navigator, components, translator, votes, api, bootbox, alerts, hooks, helpers) {
	const PostTools = {};

	let staleReplyAnyway = false;

	PostTools.init = function (tid) {
		staleReplyAnyway = false;

		renderMenu();

		addPostHandlers(tid);

		share.addShareHandlers(ajaxify.data.titleRaw);

		votes.addVoteHandler();

		PostTools.updatePostCount(ajaxify.data.postcount);
	};

	function renderMenu() {
		const container = document.querySelector('[component="topic"]');
		if (!container) {
			return;
		}
		$('[component="topic"]').on('show.bs.dropdown', '[component="post/tools"]', function () {
			const $this = $(this);
			const dropdownMenu = $this.find('.dropdown-menu');
			const { top } = this.getBoundingClientRect();
			$this.toggleClass('dropup', top > window.innerHeight / 2);

			if (dropdownMenu.attr('data-loaded')) {
				return;
			}
			dropdownMenu.html(helpers.generatePlaceholderWave([
				3, 5, 9, 7, 10, 'divider', 10,
			]));

			const postEl = $this.parents('[data-pid]');
			const pid = postEl.attr('data-pid');
			const index = parseInt(postEl.attr('data-index'), 10);

			socket.emit('posts.loadPostTools', { pid: pid }, async (err, data) => {
				if (err) {
					return alerts.error(err);
				}
				data.posts.display_move_tools = data.posts.display_move_tools && index !== 0;

				const html = await app.parseAndTranslate('partials/topic/post-menu-list', data);
				const clipboard = require('clipboard');

				dropdownMenu.attr('data-loaded', 'true').html(html);

				new clipboard('[data-clipboard-text]');

				hooks.fire('action:post.tools.load', {
					element: dropdownMenu,
				});
			});
		});
	}

	PostTools.toggle = function (pid, isDeleted) {
		const postEl = components.get('post', 'pid', pid);

		postEl.find('[component="post/quote"], [component="post/bookmark"], [component="post/reply"], [component="post/flag"], [component="user/chat"]')
			.toggleClass('hidden', isDeleted);

		postEl.find('[component="post/delete"]').toggleClass('hidden', isDeleted).parent().attr('hidden', isDeleted ? '' : null);
		postEl.find('[component="post/restore"]').toggleClass('hidden', !isDeleted).parent().attr('hidden', !isDeleted ? '' : null);
		postEl.find('[component="post/purge"]').toggleClass('hidden', !isDeleted).parent().attr('hidden', !isDeleted ? '' : null);

		PostTools.removeMenu(postEl);
	};

	PostTools.removeMenu = function (postEl) {
		postEl.find('[component="post/tools"] .dropdown-menu')
			.removeAttr('data-loaded').html('');
	};

	PostTools.updatePostCount = function (postCount) {
		const postCountEl = components.get('topic/post-count');
		postCountEl.attr('title', postCount)
			.html(helpers.humanReadableNumber(postCount));
		navigator.setCount(postCount);
	};

	function addPostHandlers(tid) {
		const postContainer = components.get('topic');

		handleSelectionTooltip();

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
			translator.translate(`[[topic:link-back, ${ajaxify.data.titleRaw}, ${config.relative_path}/topic/${ajaxify.data.slug}]]`, function (body) {
				hooks.fire('action:composer.topic.new', {
					cid: ajaxify.data.cid,
					body: body,
				});
			});
		});

		postContainer.on('click', '[component="post/bookmark"]', function () {
			return bookmarkPost($(this), getData($(this), 'data-pid'));
		});

		postContainer.on('click', '[component="post/upvote"]', function () {
			return votes.toggleVote($(this), '.upvoted', 1);
		});

		postContainer.on('click', '[component="post/downvote"]', function () {
			return votes.toggleVote($(this), '.downvoted', -1);
		});

		postContainer.on('click', '[component="post/vote-count"]', function () {
			votes.showVotes(getData($(this), 'data-pid'));
		});

		postContainer.on('click', '[component="post/announce-count"]', function () {
			votes.showAnnouncers(getData($(this), 'data-pid'));
		});

		postContainer.on('click', '[component="post/flag"]', function () {
			const pid = getData($(this), 'data-pid');
			require(['flags'], function (flags) {
				flags.showFlagModal({
					type: 'post',
					id: pid,
				});
			});
		});

		postContainer.on('click', '[component="post/already-flagged"]', function () {
			const flagId = $(this).data('flag-id');
			require(['flags'], function (flags) {
				bootbox.confirm('[[flags:modal-confirm-rescind]]', function (confirm) {
					if (!confirm) {
						return;
					}
					flags.rescind(flagId);
				});
			});
		});

		postContainer.on('click', '[component="post/flagUser"]', function () {
			const uid = getData($(this), 'data-uid');
			require(['flags'], function (flags) {
				flags.showFlagModal({
					type: 'user',
					id: uid,
				});
			});
		});

		postContainer.on('click', '[component="post/flagResolve"]', function () {
			const flagId = $(this).attr('data-flagId');
			require(['flags'], function (flags) {
				flags.resolve(flagId);
			});
		});

		postContainer.on('click', '[component="post/edit"]', function () {
			const btn = $(this);

			const timestamp = parseInt(getData(btn, 'data-timestamp'), 10);
			const postEditDuration = parseInt(ajaxify.data.postEditDuration, 10);

			if (checkDuration(postEditDuration, timestamp, 'post-edit-duration-expired')) {
				hooks.fire('action:composer.post.edit', {
					pid: getData(btn, 'data-pid'),
				});
			}
		});

		if (config.enablePostHistory && ajaxify.data.privileges['posts:history']) {
			postContainer.on('click', '[component="post/view-history"], [component="post/edit-indicator"]', function () {
				const btn = $(this);
				require(['forum/topic/diffs'], function (diffs) {
					diffs.open(getData(btn, 'data-pid'));
				});
			});
		}

		postContainer.on('click', '[component="post/delete"]', function () {
			const btn = $(this);
			const timestamp = parseInt(getData(btn, 'data-timestamp'), 10);
			const postDeleteDuration = parseInt(ajaxify.data.postDeleteDuration, 10);
			if (checkDuration(postDeleteDuration, timestamp, 'post-delete-duration-expired')) {
				togglePostDelete($(this));
			}
		});

		function checkDuration(duration, postTimestamp, languageKey) {
			if (!ajaxify.data.privileges.isAdminOrMod && duration && Date.now() - postTimestamp > duration * 1000) {
				const numDays = Math.floor(duration / 86400);
				const numHours = Math.floor((duration % 86400) / 3600);
				const numMinutes = Math.floor(((duration % 86400) % 3600) / 60);
				const numSeconds = ((duration % 86400) % 3600) % 60;
				let msg = '[[error:' + languageKey + ', ' + duration + ']]';
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
				alerts.error(msg);
				return false;
			}
			return true;
		}

		postContainer.on('click', '[component="post/restore"]', function () {
			togglePostDelete($(this));
		});

		postContainer.on('click', '[component="post/purge"]', function () {
			purgePost($(this));
		});

		postContainer.on('click', '[component="post/move"]', function () {
			const btn = $(this);
			require(['forum/topic/move-post'], function (movePost) {
				movePost.init(btn.parents('[data-pid]'));
			});
		});

		postContainer.on('click', '[component="post/change-owner"]', function () {
			const btn = $(this);
			require(['forum/topic/change-owner'], function (changeOwner) {
				changeOwner.init(btn.parents('[data-pid]'));
			});
		});

		postContainer.on('click', '[component="post/manage-editors"]', function () {
			const btn = $(this);
			require(['forum/topic/manage-editors'], function (manageEditors) {
				manageEditors.init(btn.parents('[data-pid]'));
			});
		});

		postContainer.on('click', '[component="post/ban-ip"]', function () {
			const ip = $(this).attr('data-ip');
			socket.emit('blacklist.addRule', ip, function (err) {
				if (err) {
					return alerts.error(err);
				}
				alerts.success('[[admin/manage/blacklist:ban-ip]]');
			});
		});

		postContainer.on('click', '[component="post/chat"]', function () {
			openChat($(this));
		});
	}

	async function onReplyClicked(button, tid) {
		const selectedNode = await getSelectedNode();

		showStaleWarning(async function () {
			let username = await getUserSlug(button);
			if (getData(button, 'data-uid') === '0' || !getData(button, 'data-userslug')) {
				username = '';
			}

			const toPid = button.is('[component="post/reply"]') ? getData(button, 'data-pid') : null;
			const isQuoteToPid = !toPid || !selectedNode.pid || toPid === selectedNode.pid;

			if (selectedNode.text && isQuoteToPid) {
				username = username || selectedNode.username;
				hooks.fire('action:composer.addQuote', {
					tid: tid,
					pid: toPid,
					title: ajaxify.data.titleRaw,
					username: username,
					body: selectedNode.text,
					selectedPid: selectedNode.pid,
				});
			} else {
				hooks.fire('action:composer.post.new', {
					tid: tid,
					pid: toPid,
					title: ajaxify.data.titleRaw,
					body: username ? username + ' ' : ($('[component="topic/quickreply/text"]').val() || ''),
				});
			}
		});
	}

	async function onQuoteClicked(button, tid) {
		const selectedNode = await getSelectedNode();

		showStaleWarning(async function () {
			const username = await getUserSlug(button);
			const toPid = getData(button, 'data-pid');

			function quote(text) {
				hooks.fire('action:composer.addQuote', {
					tid: tid,
					pid: toPid,
					username: username,
					title: ajaxify.data.titleRaw,
					text: text,
				});
			}

			if (selectedNode.text && toPid && toPid === selectedNode.pid) {
				return quote(selectedNode.text);
			}

			const { content } = await api.get(`/posts/${encodeURIComponent(toPid)}/raw`);
			quote(content);
		});
	}

	async function getSelectedNode() {
		let selectedText = '';
		let selectedPid;
		let username = '';
		const selection = window.getSelection ? window.getSelection() : document.selection.createRange();
		const postContents = $('[component="post"] [component="post/content"]');
		let content;
		postContents.each(function (index, el) {
			if (selection && selection.containsNode && el && selection.containsNode(el, true)) {
				content = el;
			}
		});

		if (content && selection) {
			selectedText = selection.toString();
			const postEl = $(content).parents('[component="post"]');
			selectedPid = postEl.attr('data-pid');
			username = await getUserSlug($(content));
		}
		return { text: selectedText, pid: selectedPid, username: username };
	}

	function bookmarkPost(button, pid) {
		const method = button.attr('data-bookmarked') === 'false' ? 'put' : 'del';

		api[method](`/posts/${encodeURIComponent(pid)}/bookmark`, undefined, function (err) {
			if (err) {
				return alerts.error(err);
			}
			const type = method === 'put' ? 'bookmark' : 'unbookmark';
			hooks.fire(`action:post.${type}`, { pid: pid });
		});
		return false;
	}

	function getData(button, data) {
		return button.parents('[data-pid]').attr(data);
	}

	function getUserSlug(button) {
		return new Promise((resolve) => {
			let slug = '';
			if (button.attr('component') === 'topic/reply') {
				resolve(slug);
				return;
			}
			const post = button.parents('[data-pid]');
			if (post.length && !post.hasClass('self-post')) {
				require(['slugify'], function (slugify) {
					slug = slugify(post.attr('data-username'), true);
					if (!slug) {
						if (post.attr('data-uid') !== '0') {
							slug = '[[global:former-user]]';
						} else {
							slug = '[[global:guest]]';
						}
					}
					if (slug && slug !== '[[global:former-user]]' && slug !== '[[global:guest]]') {
						slug = '@' + slug;
					}
					resolve(slug);
				});
				return;
			}

			resolve(slug);
		});
	}

	function togglePostDelete(button) {
		const pid = getData(button, 'data-pid');
		const postEl = components.get('post', 'pid', pid);
		const action = !postEl.hasClass('deleted') ? 'delete' : 'restore';

		postAction(action, pid);
	}

	function purgePost(button) {
		postAction('purge', getData(button, 'data-pid'));
	}

	async function postAction(action, pid) {
		({ action } = await hooks.fire(`static:post.${action}`, { action, pid }));
		if (!action) {
			return;
		}

		bootbox.confirm('[[topic:post-' + action + '-confirm]]', function (confirm) {
			if (!confirm) {
				return;
			}

			const route = action === 'purge' ? '' : '/state';
			const method = action === 'restore' ? 'put' : 'del';
			api[method](`/posts/${encodeURIComponent(pid)}${route}`).catch(alerts.error);
		});
	}

	function openChat(button) {
		const post = button.parents('[data-pid]');
		require(['chat'], function (chat) {
			chat.newChat(post.attr('data-uid'));
		});
		button.parents('.btn-group').find('.dropdown-toggle').click();
		return false;
	}

	function showStaleWarning(callback) {
		const topicStaleDays = parseInt(ajaxify.data.topicStaleDays, 10);
		if (!topicStaleDays) {
			return callback();
		}
		const staleThreshold = Math.min(
			Date.now() - (1000 * 60 * 60 * 24 * ajaxify.data.topicStaleDays),
			8640000000000000
		);
		if (staleReplyAnyway || ajaxify.data.lastposttime >= staleThreshold) {
			return callback();
		}

		const warning = bootbox.dialog({
			title: '[[topic:stale.title]]',
			message: '[[topic:stale.warning]]',
			buttons: {
				reply: {
					label: '[[topic:stale.reply-anyway]]',
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
						translator.translate(`[[topic:link-back, ${ajaxify.data.title}, ${config.relative_path}/topic/${ajaxify.data.slug}]]`, function (body) {
							hooks.fire('action:composer.topic.new', {
								cid: ajaxify.data.cid,
								body: body,
								fromStaleTopic: true,
							});
						});
					},
				},
			},
		});

		warning.modal();
	}

	const selectionChangeFn = utils.debounce(selectionChange, 250);

	function handleSelectionTooltip() {
		if (!ajaxify.data.privileges['topics:reply']) {
			return;
		}

		hooks.onPage('action:posts.loaded', delayedTooltip);
		$(document).off('selectionchange');
		$(document).on('selectionchange', function () {
			const selectionEmpty = window.getSelection().toString() === '';
			if (selectionEmpty) {
				$('[component="selection/tooltip"]').addClass('hidden');
			}
		});
		$(document).on('selectionchange', selectionChangeFn);
	}

	function selectionChange() {
		const selectionEmpty = window.getSelection().toString() === '';
		if (!selectionEmpty) {
			delayedTooltip();
		}
	}

	async function delayedTooltip() {
		let selectionTooltip = $('[component="selection/tooltip"]');
		selectionTooltip.addClass('hidden');
		if (selectionTooltip.attr('data-ajaxify') === '1') {
			selectionTooltip.remove();
			return;
		}

		const selection = window.getSelection();
		if (selection.focusNode && selection.type === 'Range' && ajaxify.data.template.topic) {
			const focusNode = $(selection.focusNode);
			const anchorNode = $(selection.anchorNode);
			const firstPid = anchorNode.parents('[data-pid]').attr('data-pid');
			const lastPid = focusNode.parents('[data-pid]').attr('data-pid');
			if (firstPid !== lastPid || !focusNode.parents('[component="post/content"]').length || !anchorNode.parents('[component="post/content"]').length) {
				return;
			}
			const postEl = focusNode.parents('[data-pid]');
			const selectionRange = selection.getRangeAt(0);
			if (!postEl.length || selectionRange.collapsed) {
				return;
			}
			const rects = selectionRange.getClientRects();
			const lastRect = rects[rects.length - 1];

			if (!selectionTooltip.length) {
				selectionTooltip = await app.parseAndTranslate('partials/topic/selection-tooltip', ajaxify.data);
				$('[component="selection/tooltip"]').remove();
				selectionTooltip.addClass('hidden').appendTo('body');
			}
			selectionTooltip.off('click').on('click', '[component="selection/tooltip/quote"]', function () {
				selectionTooltip.addClass('hidden');
				onQuoteClicked(postEl.find('[component="post/quote"]'), ajaxify.data.tid);
			});
			selectionTooltip.removeClass('hidden');
			$(window).one('action:ajaxify.start', function () {
				selectionTooltip.attr('data-ajaxify', 1).addClass('hidden');
				$(document).off('selectionchange', selectionChangeFn);
			});
			const tooltipWidth = selectionTooltip.outerWidth(true);
			selectionTooltip.css({
				top: lastRect.bottom + $(window).scrollTop(),
				left: tooltipWidth > lastRect.width ? lastRect.left : lastRect.left + lastRect.width - tooltipWidth,
			});
		}
	}

	return PostTools;
});
