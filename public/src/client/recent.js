'use strict';

define('forum/recent', ['forum/infinitescroll', 'components', 'handleBack'], function (infinitescroll, components, handleBack) {
	var	Recent = {};

	var newTopicCount = 0;
	var newPostCount = 0;

	$(window).on('action:ajaxify.start', function (ev, data) {
		if (ajaxify.currentPage !== data.url) {
			Recent.removeListeners();
		}
	});

	Recent.init = function () {
		app.enterRoom('recent_topics');

		Recent.watchForNewPosts();

		Recent.handleCategorySelection();

		handleBack.init(function (after, cb) {
			loadTopicsAfter(after, 1, cb);
		});

		$('#new-topics-alert').on('click', function () {
			$(this).addClass('hide');
		});

		if (!config.usePagination) {
			infinitescroll.init(Recent.loadMoreTopics);
		}

		$(window).trigger('action:topics.loaded', { topics: ajaxify.data.topics });
	};

	Recent.watchForNewPosts = function () {
		newPostCount = 0;
		newTopicCount = 0;
		Recent.removeListeners();
		socket.on('event:new_topic', onNewTopic);
		socket.on('event:new_post', onNewPost);
	};

	function onNewTopic(data) {
		if (ajaxify.data.selectedCids && ajaxify.data.selectedCids.indexOf(parseInt(data.cid, 10)) === -1) {
			return;
		}

		if (ajaxify.data.selectedFilter && ajaxify.data.selectedFilter.filter === 'watched') {
			return;
		}

		if (ajaxify.data.template.category && parseInt(ajaxify.data.cid, 10) !== parseInt(data.cid, 10)) {
			return;
		}

		newTopicCount += 1;
		Recent.updateAlertText();
	}

	function onNewPost(data) {
		function showAlert() {
			newPostCount += 1;
			Recent.updateAlertText();
		}

		var post = data.posts[0];
		if (!post || !post.topic) {
			return;
		}
		if (parseInt(post.topic.mainPid, 10) === parseInt(post.pid, 10)) {
			return;
		}

		if (ajaxify.data.selectedCids && ajaxify.data.selectedCids.indexOf(parseInt(post.topic.cid, 10)) === -1) {
			return;
		}

		if (ajaxify.data.selectedFilter && ajaxify.data.selectedFilter.filter === 'new') {
			return;
		}

		if (ajaxify.data.template.category && parseInt(ajaxify.data.cid, 10) !== parseInt(post.topic.cid, 10)) {
			return;
		}

		if (ajaxify.data.selectedFilter && ajaxify.data.selectedFilter.filter === 'watched') {
			socket.emit('topics.isFollowed', post.tid, function (err, isFollowed) {
				if (err) {
					app.alertError(err.message);
				}
				if (isFollowed) {
					showAlert();
				}
			});
			return;
		}

		showAlert();
	}

	Recent.handleCategorySelection = function () {
		function getSelectedCids() {
			var cids = [];
			$('[component="category/list"] [data-cid]').each(function (index, el) {
				if ($(el).find('i.fa-check').length) {
					cids.push(parseInt($(el).attr('data-cid'), 10));
				}
			});
			cids.sort(function (a, b) {
				return a - b;
			});
			return cids;
		}

		$('[component="category/dropdown"]').on('hidden.bs.dropdown', function () {
			var cids = getSelectedCids();
			var changed = ajaxify.data.selectedCids.length !== cids.length;
			ajaxify.data.selectedCids.forEach(function (cid, index) {
				if (cid !== cids[index]) {
					changed = true;
				}
			});

			if (changed) {
				var url = window.location.pathname;
				var currentParams = utils.params();
				if (cids.length) {
					currentParams.cid = cids;
					url += '?' + decodeURIComponent($.param(currentParams));
				}
				ajaxify.go(url);
			}
		});

		$('[component="category/list"]').on('click', '[data-cid]', function (ev) {
			function selectChildren(parentCid, flag) {
				$('[component="category/list"] [data-parent-cid="' + parentCid + '"] [component="category/select/icon"]').toggleClass('fa-check', flag);
				$('[component="category/list"] [data-parent-cid="' + parentCid + '"]').each(function (index, el) {
					selectChildren($(el).attr('data-cid'), flag);
				});
			}
			var categoryEl = $(this);
			var cid = $(this).attr('data-cid');
			if (ev.ctrlKey) {
				selectChildren(cid, !categoryEl.find('[component="category/select/icon"]').hasClass('fa-check'));
			}
			categoryEl.find('[component="category/select/icon"]').toggleClass('fa-check');
			$('[component="category/list"] li').first().find('i').toggleClass('fa-check', !getSelectedCids().length);
			return false;
		});
	};

	Recent.removeListeners = function () {
		socket.removeListener('event:new_topic', onNewTopic);
		socket.removeListener('event:new_post', onNewPost);
	};

	Recent.updateAlertText = function () {
		var text = '';

		if (newTopicCount === 0) {
			if (newPostCount === 1) {
				text = '[[recent:there-is-a-new-post]]';
			} else if (newPostCount > 1) {
				text = '[[recent:there-are-new-posts, ' + newPostCount + ']]';
			}
		} else if (newTopicCount === 1) {
			if (newPostCount === 0) {
				text = '[[recent:there-is-a-new-topic]]';
			} else if (newPostCount === 1) {
				text = '[[recent:there-is-a-new-topic-and-a-new-post]]';
			} else if (newPostCount > 1) {
				text = '[[recent:there-is-a-new-topic-and-new-posts, ' + newPostCount + ']]';
			}
		} else if (newTopicCount > 1) {
			if (newPostCount === 0) {
				text = '[[recent:there-are-new-topics, ' + newTopicCount + ']]';
			} else if (newPostCount === 1) {
				text = '[[recent:there-are-new-topics-and-a-new-post, ' + newTopicCount + ']]';
			} else if (newPostCount > 1) {
				text = '[[recent:there-are-new-topics-and-new-posts, ' + newTopicCount + ', ' + newPostCount + ']]';
			}
		}

		text += ' [[recent:click-here-to-reload]]';

		$('#new-topics-alert').translateText(text).removeClass('hide').fadeIn('slow');
		$('#category-no-topics').addClass('hide');
	};

	Recent.loadMoreTopics = function (direction) {
		if (!$('[component="category"]').length) {
			return;
		}
		var topics = $('[component="category/topic"]');
		var afterEl = direction > 0 ? topics.last() : topics.first();
		var after = (parseInt(afterEl.attr('data-index'), 10) || 0) + (direction > 0 ? 1 : 0);
		loadTopicsAfter(after, direction);
	};

	function loadTopicsAfter(after, direction, callback) {
		callback = callback || function () {};
		infinitescroll.loadMore('topics.loadMoreRecentTopics', {
			after: after,
			direction: direction,
			count: config.topicsPerPage,
			cid: utils.params().cid,
			filter: ajaxify.data.selectedFilter.filter,
			set: $('[component="category"]').attr('data-set') ? $('[component="category"]').attr('data-set') : 'topics:recent',
		}, function (data, done) {
			if (data.topics && data.topics.length) {
				Recent.onTopicsLoaded('recent', data.topics, false, direction, done);
			} else {
				done();
			}
			$('[component="category"]').attr('data-nextstart', data.nextStart);
			callback();
		});
	}

	Recent.onTopicsLoaded = function (templateName, topics, showSelect, direction, callback) {
		topics = topics.filter(function (topic) {
			return !components.get('category/topic', 'tid', topic.tid).length;
		});

		if (!topics.length) {
			return callback();
		}

		var after;
		var before;
		var topicsList = $('[component="category/topic"]');

		if (direction > 0 && topics.length) {
			after = topicsList.last();
		} else if (direction < 0 && topics.length) {
			before = topicsList.first();
		}

		app.parseAndTranslate(templateName, 'topics', { topics: topics, showSelect: showSelect }, function (html) {
			$('#category-no-topics').remove();

			if (after && after.length) {
				html.insertAfter(after);
			} else if (before && before.length) {
				var height = $(document).height();
				var scrollTop = $(window).scrollTop();

				html.insertBefore(before);

				$(window).scrollTop(scrollTop + ($(document).height() - height));
			} else {
				$('[component="category"]').append(html);
			}

			html.find('.timeago').timeago();
			app.createUserTooltips();
			utils.makeNumbersHumanReadable(html.find('.human-readable-number'));
			$(window).trigger('action:topics.loaded', { topics: topics });
			callback();
		});
	};

	return Recent;
});
