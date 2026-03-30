'use strict';


define('forum/topic/threadTools', [
	'components',
	'translator',
	'handleBack',
	'forum/topic/posts',
	'api',
	'hooks',
	'bootbox',
	'alerts',
	'bootstrap',
	'helpers',
], function (components, translator, handleBack, posts, api, hooks, bootbox, alerts, bootstrap, helpers) {
	const ThreadTools = {};

	ThreadTools.init = function (tid, topicContainer) {
		renderMenu(topicContainer);

		$('.topic-main-buttons [title]').tooltip({
			container: '#content',
			animation: false,
		});

		ThreadTools.observeTopicLabels($('[component="topic/labels"]'));

		// function topicCommand(method, path, command, onComplete) {
		topicContainer.on('click', '[component="topic/delete"]', function () {
			topicCommand('del', '/state', 'delete');
			return false;
		});

		topicContainer.on('click', '[component="topic/restore"]', function () {
			topicCommand('put', '/state', 'restore');
			return false;
		});

		topicContainer.on('click', '[component="topic/purge"]', function () {
			topicCommand('del', '', 'purge');
			return false;
		});

		topicContainer.on('click', '[component="topic/lock"]', function () {
			topicCommand('put', '/lock', 'lock');
			return false;
		});

		topicContainer.on('click', '[component="topic/unlock"]', function () {
			topicCommand('del', '/lock', 'unlock');
			return false;
		});

		topicContainer.on('click', '[component="topic/pin"]', function () {
			topicCommand('put', '/pin', 'pin');
			return false;
		});

		topicContainer.on('click', '[component="topic/unpin"]', function () {
			topicCommand('del', '/pin', 'unpin');
			return false;
		});

		topicContainer.on('click', '[component="topic/mark-unread"]', function () {
			topicCommand('del', '/read', undefined, () => {
				if (app.previousUrl && !app.previousUrl.match('^/topic')) {
					ajaxify.go(app.previousUrl, function () {
						handleBack.onBackClicked(true);
					});
				} else if (ajaxify.data.category) {
					ajaxify.go('category/' + ajaxify.data.category.slug, handleBack.onBackClicked);
				}

				alerts.success('[[topic:mark-unread.success]]');
			});
		});

		topicContainer.on('click', '[component="topic/mark-unread-for-all"]', function () {
			const btn = $(this);
			topicCommand('put', '/bump', undefined, () => {
				alerts.success('[[topic:markAsUnreadForAll.success]]');
				btn.parents('.thread-tools.open').find('.dropdown-toggle').trigger('click');
			});
		});

		topicContainer.on('click', '[component="topic/event/delete"]', function () {
			const eventId = $(this).attr('data-topic-event-id');
			const eventEl = $(this).parents('[data-topic-event-id]');
			bootbox.confirm('[[topic:delete-event-confirm]]', (ok) => {
				if (ok) {
					api.del(`/topics/${tid}/events/${eventId}`, {})
						.then(function () {
							const itemsParent = eventEl.parents('[component="topic/event/items"]');
							eventEl.remove();
							if (itemsParent.length) {
								const childrenCount = itemsParent.children().length;
								const eventParent = itemsParent.parents('[component="topic/event"]');
								if (!childrenCount) {
									eventParent.remove();
								} else {
									eventParent
										.find('[data-bs-toggle]')
										.translateText(`[[topic:announcers-x, ${childrenCount}]]`);
								}
							}
						})
						.catch(alerts.error);
				}
			});
		});

		topicContainer.on('click', '[component="topic/move"]', function () {
			require(['forum/topic/move'], function (move) {
				move.init([tid], ajaxify.data.cid);
			});
			return false;
		});

		topicContainer.on('click', '[component="topic/crosspost"]', () => {
			require(['forum/topic/crosspost'], (crosspost) => {
				crosspost.init(tid, ajaxify.data.cid);
			});
		});

		topicContainer.on('click', '[component="topic/delete/posts"]', function () {
			require(['forum/topic/delete-posts'], function (deletePosts) {
				deletePosts.init();
			});
		});

		topicContainer.on('click', '[component="topic/fork"]', function () {
			require(['forum/topic/fork'], function (fork) {
				fork.init();
			});
		});

		topicContainer.on('click', '[component="topic/merge"]', function () {
			require(['forum/topic/merge'], function (merge) {
				merge.init(function () {
					merge.addTopic(ajaxify.data.tid);
				});
			});
		});

		topicContainer.on('click', '[component="topic/tag"]', function () {
			require(['forum/topic/tag'], function (tag) {
				tag.init([ajaxify.data], ajaxify.data.tagWhitelist);
			});
		});

		topicContainer.on('click', '[component="topic/move-posts"]', function () {
			require(['forum/topic/move-post'], function (movePosts) {
				movePosts.init();
			});
		});

		topicContainer.on('click', '[component="topic/following"]', function () {
			changeWatching('follow');
		});
		topicContainer.on('click', '[component="topic/not-following"]', function () {
			changeWatching('follow', 0);
		});
		topicContainer.on('click', '[component="topic/ignoring"]', function () {
			changeWatching('ignore');
		});

		function changeWatching(type, state = 1) {
			const method = state ? 'put' : 'del';
			api[method](`/topics/${tid}/${type}`, {}, () => {
				let message = '';
				if (type === 'follow') {
					message = state ? '[[topic:following-topic.message]]' : '[[topic:not-following-topic.message]]';
				} else if (type === 'ignore') {
					message = state ? '[[topic:ignoring-topic.message]]' : '[[topic:not-following-topic.message]]';
				}

				// From here on out, type changes to 'unfollow' if state is falsy
				if (!state) {
					type = 'unfollow';
				}

				setFollowState(type);

				alerts.alert({
					alert_id: 'follow_thread',
					message: message,
					type: 'success',
					timeout: 5000,
				});

				hooks.fire('action:topics.changeWatching', { tid: tid, type: type });
			}, () => {
				alerts.alert({
					type: 'danger',
					alert_id: 'topic_follow',
					title: '[[global:please-log-in]]',
					message: '[[topic:login-to-subscribe]]',
					timeout: 5000,
				});
			});

			return false;
		}
	};

	ThreadTools.observeTopicLabels = function (labels) {
		// show or hide topic/labels container depending on children visibility
		const mut = new MutationObserver(function (mutations) {
			const first = mutations[0];
			if (first && first.attributeName === 'class') {
				const visibleChildren = labels.children().filter((index, el) => !$(el).hasClass('hidden'));
				labels.toggleClass('hidden', !visibleChildren.length);
			}
		});

		labels.children().each((index, el) => {
			mut.observe(el, { attributes: true });
		});
	};

	function renderMenu(container) {
		if (!container) {
			return;
		}
		container.on('show.bs.dropdown', '.thread-tools', async function () {
			const $this = $(this);
			const dropdownMenu = $this.find('.dropdown-menu');
			const { top } = this.getBoundingClientRect();
			$this.toggleClass('dropup', top > window.innerHeight / 2);
			if (dropdownMenu.attr('data-loaded')) {
				return;
			}
			dropdownMenu.html(helpers.generatePlaceholderWave([8, 8, 8]));
			const data = await socket.emit('topics.loadTopicTools', { tid: ajaxify.data.tid, cid: ajaxify.data.cid }).catch(alerts.error);
			const html = await app.parseAndTranslate('partials/topic/topic-menu-list', data);
			$(dropdownMenu).attr('data-loaded', 'true').html(html);
			hooks.fire('action:topic.tools.load', {
				element: $(dropdownMenu),
			});
		});
	}

	function topicCommand(method, path, command, onComplete) {
		if (!onComplete) {
			onComplete = function () {};
		}
		const tid = ajaxify.data.tid;
		const body = {};
		const execute = function (ok) {
			if (ok) {
				api[method](`/topics/${tid}${path}`, body)
					.then(onComplete)
					.catch(alerts.error);
			}
		};

		switch (command) {
			case 'delete':
			case 'restore':
			case 'purge':
				bootbox.confirm(`[[topic:thread-tools.${command}-confirm]]`, execute);
				break;

			case 'pin':
				ThreadTools.requestPinExpiry(body, execute.bind(null, true));
				break;

			default:
				execute(true);
				break;
		}
	}

	ThreadTools.requestPinExpiry = function (body, onSuccess) {
		app.parseAndTranslate('modals/set-pin-expiry', {}, function (html) {
			const modal = bootbox.dialog({
				title: '[[topic:thread-tools.pin]]',
				message: html,
				onEscape: true,
				buttons: {
					cancel: {
						label: '[[modules:bootbox.cancel]]',
						className: 'btn-link',
					},
					save: {
						label: '[[global:save]]',
						className: 'btn-primary',
						callback: function () {
							const expiryDateEl = modal.get(0).querySelector('#expiry-date');
							const expiryTimeEl = modal.get(0).querySelector('#expiry-time');
							let expiryDate = expiryDateEl.value;
							let expiryTime = expiryTimeEl.value;
							// No expiry set
							if (expiryDate === '' && expiryTime === '') {
								return onSuccess();
							}
							expiryDate = expiryDate || new Date().toDateString();
							expiryTime = expiryTime || new Date().toTimeString();
							const date = new Date(`${expiryDate} ${expiryTime}`);
							if (date.getTime() > Date.now()) {
								body.expiry = date.getTime();
								onSuccess();
							} else {
								alerts.error('[[error:invalid-date]]');
							}
						},
					},
				},
			});
		});
	};

	ThreadTools.setLockedState = function (data) {
		const threadEl = components.get('topic');
		if (String(data.tid) !== threadEl.attr('data-tid')) {
			return;
		}

		const isLocked = data.isLocked && !ajaxify.data.privileges.isAdminOrMod;

		components.get('topic/lock').toggleClass('hidden', data.isLocked).parent().attr('hidden', data.isLocked ? '' : null);
		components.get('topic/unlock').toggleClass('hidden', !data.isLocked).parent().attr('hidden', !data.isLocked ? '' : null);

		const hideReply = !!((data.isLocked || ajaxify.data.deleted) && !ajaxify.data.privileges.isAdminOrMod);

		components.get('topic/reply/container').toggleClass('hidden', hideReply);
		components.get('topic/reply/locked').toggleClass('hidden', ajaxify.data.privileges.isAdminOrMod || !data.isLocked || ajaxify.data.deleted);

		threadEl.find('[component="post"]:not(.deleted) [component="post/reply"], [component="post"]:not(.deleted) [component="post/quote"]').toggleClass('hidden', hideReply);
		threadEl.find('[component="post/edit"], [component="post/delete"]').toggleClass('hidden', isLocked);

		threadEl.find('[component="post"][data-uid="' + app.user.uid + '"].deleted [component="post/tools"]').toggleClass('hidden', isLocked);

		$('[component="topic/labels"] [component="topic/locked"]').toggleClass('hidden', !data.isLocked);
		$('[component="post/tools"] .dropdown-menu').html('');
		ajaxify.data.locked = data.isLocked;

		posts.addTopicEvents(data.events);
	};

	ThreadTools.setDeleteState = function (data) {
		const threadEl = components.get('topic');
		if (String(data.tid) !== threadEl.attr('data-tid')) {
			return;
		}

		components.get('topic/delete').toggleClass('hidden', data.isDelete).parent().attr('hidden', data.isDelete ? '' : null);
		components.get('topic/restore').toggleClass('hidden', !data.isDelete).parent().attr('hidden', !data.isDelete ? '' : null);
		components.get('topic/purge').toggleClass('hidden', !data.isDelete).parent().attr('hidden', !data.isDelete ? '' : null);
		components.get('topic/deleted/message').toggleClass('hidden', !data.isDelete);

		if (data.isDelete) {
			app.parseAndTranslate('partials/topic/deleted-message', {
				deleter: data.user,
				deleted: true,
				deletedTimestampISO: utils.toISOString(Date.now()),
			}, function (html) {
				components.get('topic/deleted/message').replaceWith(html);
				html.find('.timeago').timeago();
			});
		}
		const hideReply = data.isDelete && !ajaxify.data.privileges.isAdminOrMod;

		components.get('topic/reply/container').toggleClass('hidden', hideReply);
		components.get('topic/reply/locked').toggleClass('hidden', ajaxify.data.privileges.isAdminOrMod || !ajaxify.data.locked || data.isDelete);
		threadEl.find('[component="post"]:not(.deleted) [component="post/reply"], [component="post"]:not(.deleted) [component="post/quote"]').toggleClass('hidden', hideReply);

		threadEl.toggleClass('deleted', data.isDelete);
		ajaxify.data.deleted = data.isDelete ? 1 : 0;

		posts.addTopicEvents(data.events);
	};


	ThreadTools.setPinnedState = function (data) {
		const threadEl = components.get('topic');
		if (String(data.tid) !== threadEl.attr('data-tid')) {
			return;
		}

		components.get('topic/pin').toggleClass('hidden', data.pinned).parent().attr('hidden', data.pinned ? '' : null);
		components.get('topic/unpin').toggleClass('hidden', !data.pinned).parent().attr('hidden', !data.pinned ? '' : null);
		const icon = $('[component="topic/labels"] [component="topic/pinned"]');
		icon.toggleClass('hidden', !data.pinned);
		if (data.pinned) {
			icon.translateAttr('title', (
				data.pinExpiry && data.pinExpiryISO ?
					'[[topic:pinned-with-expiry, ' + data.pinExpiryISO + ']]' :
					'[[topic:pinned]]'
			));
		}
		ajaxify.data.pinned = data.pinned;

		posts.addTopicEvents(data.events);
	};

	function setFollowState(state) {
		const titles = {
			follow: '[[topic:watching]]',
			unfollow: '[[topic:not-watching]]',
			ignore: '[[topic:ignoring]]',
		};

		translator.translate(titles[state], function (translatedTitle) {
			const tooltip = bootstrap.Tooltip.getInstance('[component="topic/watch"]');
			if (tooltip) {
				tooltip.setContent({ '.tooltip-inner': translatedTitle });
			}
		});

		let menu = components.get('topic/following/menu');
		menu.toggleClass('hidden', state !== 'follow');
		components.get('topic/following/check').toggleClass('fa-check', state === 'follow');

		menu = components.get('topic/not-following/menu');
		menu.toggleClass('hidden', state !== 'unfollow');
		components.get('topic/not-following/check').toggleClass('fa-check', state === 'unfollow');

		menu = components.get('topic/ignoring/menu');
		menu.toggleClass('hidden', state !== 'ignore');
		components.get('topic/ignoring/check').toggleClass('fa-check', state === 'ignore');
	}


	return ThreadTools;
});
