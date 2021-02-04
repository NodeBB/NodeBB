'use strict';


define('forum/topic/threadTools', [
	'components',
	'translator',
	'handleBack',
	'forum/topic/posts',
	'api',
], function (components, translator, handleBack, posts, api) {
	var ThreadTools = {};

	ThreadTools.init = function (tid, topicContainer) {
		renderMenu(topicContainer);

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

		// todo: should also use topicCommand, but no write api call exists for this yet
		topicContainer.on('click', '[component="topic/mark-unread"]', function () {
			socket.emit('topics.markUnread', tid, function (err) {
				if (err) {
					return app.alertError(err);
				}

				if (app.previousUrl && !app.previousUrl.match('^/topic')) {
					ajaxify.go(app.previousUrl, function () {
						handleBack.onBackClicked(true);
					});
				} else if (ajaxify.data.category) {
					ajaxify.go('category/' + ajaxify.data.category.slug, handleBack.onBackClicked);
				}

				app.alertSuccess('[[topic:mark_unread.success]]');
			});
			return false;
		});

		topicContainer.on('click', '[component="topic/mark-unread-for-all"]', function () {
			var btn = $(this);
			socket.emit('topics.markAsUnreadForAll', [tid], function (err) {
				if (err) {
					return app.alertError(err.message);
				}
				app.alertSuccess('[[topic:markAsUnreadForAll.success]]');
				btn.parents('.thread-tools.open').find('.dropdown-toggle').trigger('click');
			});
			return false;
		});

		topicContainer.on('click', '[component="topic/move"]', function () {
			require(['forum/topic/move'], function (move) {
				move.init([tid], ajaxify.data.cid);
			});
			return false;
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
				var message = '';
				if (type === 'follow') {
					message = state ? '[[topic:following_topic.message]]' : '[[topic:not_following_topic.message]]';
				} else if (type === 'ignore') {
					message = state ? '[[topic:ignoring_topic.message]]' : '[[topic:not_following_topic.message]]';
				}

				// From here on out, type changes to 'unfollow' if state is falsy
				if (!state) {
					type = 'unfollow';
				}

				setFollowState(type);

				app.alert({
					alert_id: 'follow_thread',
					message: message,
					type: 'success',
					timeout: 5000,
				});

				$(window).trigger('action:topics.changeWatching', { tid: tid, type: type });
			}, () => {
				app.alert({
					type: 'danger',
					alert_id: 'topic_follow',
					title: '[[global:please_log_in]]',
					message: '[[topic:login_to_subscribe]]',
					timeout: 5000,
				});
			});

			return false;
		}
	};

	function renderMenu(container) {
		container.on('show.bs.dropdown', '.thread-tools', function () {
			var $this = $(this);
			var dropdownMenu = $this.find('.dropdown-menu');
			if (dropdownMenu.html()) {
				return;
			}

			socket.emit('topics.loadTopicTools', { tid: ajaxify.data.tid, cid: ajaxify.data.cid }, function (err, data) {
				if (err) {
					return app.alertError(err);
				}
				app.parseAndTranslate('partials/topic/topic-menu-list', data, function (html) {
					dropdownMenu.html(html);
					$(window).trigger('action:topic.tools.load', {
						element: dropdownMenu,
					});
				});
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
					.catch(app.alertError);
			}
		};

		switch (command) {
			case 'delete':
			case 'restore':
			case 'purge':
				bootbox.confirm(`[[topic:thread_tools.${command}_confirm]]`, execute);
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
				title: '[[topic:thread_tools.pin]]',
				message: html,
				onEscape: true,
				size: 'small',
				buttons: {
					cancel: {
						label: '[[modules:bootbox.cancel]]',
						className: 'btn-link',
					},
					save: {
						label: '[[global:save]]',
						className: 'btn-primary',
						callback: function () {
							const expiryEl = modal.get(0).querySelector('#expiry');
							let expiry = expiryEl.value;

							// No expiry set
							if (expiry === '') {
								return onSuccess();
							}

							// Expiration date set
							expiry = new Date(expiry);

							if (expiry && expiry.getTime() > Date.now()) {
								body.expiry = expiry.getTime();
								onSuccess();
							} else {
								app.alertError('[[error:invalid-date]]');
							}
						},
					},
				},
			});
		});
	};

	ThreadTools.setLockedState = function (data) {
		var threadEl = components.get('topic');
		if (parseInt(data.tid, 10) !== parseInt(threadEl.attr('data-tid'), 10)) {
			return;
		}

		var isLocked = data.isLocked && !ajaxify.data.privileges.isAdminOrMod;

		components.get('topic/lock').toggleClass('hidden', data.isLocked).parent().attr('hidden', data.isLocked ? '' : null);
		components.get('topic/unlock').toggleClass('hidden', !data.isLocked).parent().attr('hidden', !data.isLocked ? '' : null);

		var hideReply = !!((data.isLocked || ajaxify.data.deleted) && !ajaxify.data.privileges.isAdminOrMod);

		components.get('topic/reply/container').toggleClass('hidden', hideReply);
		components.get('topic/reply/locked').toggleClass('hidden', ajaxify.data.privileges.isAdminOrMod || !data.isLocked || ajaxify.data.deleted);

		threadEl.find('[component="post"]:not(.deleted) [component="post/reply"], [component="post"]:not(.deleted) [component="post/quote"]').toggleClass('hidden', hideReply);
		threadEl.find('[component="post/edit"], [component="post/delete"]').toggleClass('hidden', isLocked);

		threadEl.find('[component="post"][data-uid="' + app.user.uid + '"].deleted [component="post/tools"]').toggleClass('hidden', isLocked);

		$('.topic-header [component="topic/locked"]').toggleClass('hidden', !data.isLocked);
		$('[component="post/tools"] .dropdown-menu').html('');
		ajaxify.data.locked = data.isLocked;

		posts.addTopicEvents(data.events);
	};

	ThreadTools.setDeleteState = function (data) {
		var threadEl = components.get('topic');
		if (parseInt(data.tid, 10) !== parseInt(threadEl.attr('data-tid'), 10)) {
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
		var hideReply = data.isDelete && !ajaxify.data.privileges.isAdminOrMod;

		components.get('topic/reply/container').toggleClass('hidden', hideReply);
		components.get('topic/reply/locked').toggleClass('hidden', ajaxify.data.privileges.isAdminOrMod || !ajaxify.data.locked || data.isDelete);
		threadEl.find('[component="post"]:not(.deleted) [component="post/reply"], [component="post"]:not(.deleted) [component="post/quote"]').toggleClass('hidden', hideReply);

		threadEl.toggleClass('deleted', data.isDelete);
		ajaxify.data.deleted = data.isDelete ? 1 : 0;

		posts.addTopicEvents(data.events);
	};


	ThreadTools.setPinnedState = function (data) {
		var threadEl = components.get('topic');
		if (parseInt(data.tid, 10) !== parseInt(threadEl.attr('data-tid'), 10)) {
			return;
		}

		components.get('topic/pin').toggleClass('hidden', data.pinned).parent().attr('hidden', data.pinned ? '' : null);
		components.get('topic/unpin').toggleClass('hidden', !data.pinned).parent().attr('hidden', !data.pinned ? '' : null);
		var icon = $('.topic-header [component="topic/pinned"]');
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
		var titles = {
			follow: '[[topic:watching]]',
			unfollow: '[[topic:not-watching]]',
			ignore: '[[topic:ignoring]]',
		};
		translator.translate(titles[state], function (translatedTitle) {
			$('[component="topic/watch"] button')
				.attr('title', translatedTitle)
				.tooltip('fixTitle');
		});

		var menu = components.get('topic/following/menu');
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
