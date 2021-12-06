'use strict';


define('forum/topic/merge', ['search', 'alerts'], function (search, alerts) {
	const Merge = {};
	let modal;
	let mergeBtn;

	let selectedTids = {};

	Merge.init = function (callback) {
		callback = callback || function () {};
		if (modal) {
			return;
		}
		app.parseAndTranslate('partials/merge_topics_modal', {}, function (html) {
			modal = html;

			$('body').append(modal);

			mergeBtn = modal.find('#merge_topics_confirm');

			modal.find('.close,#merge_topics_cancel').on('click', closeModal);

			$('#content').on('click', '[component="topic/select"]', onTopicClicked);

			showTopicsSelected();

			mergeBtn.on('click', function () {
				mergeTopics(mergeBtn);
			});

			search.enableQuickSearch({
				searchElements: {
					inputEl: modal.find('.topic-search-input'),
					resultEl: modal.find('.quick-search-container'),
				},
				searchOptions: {
					in: 'titles',
				},
			});
			modal.on('click', '[data-tid]', function () {
				if ($(this).attr('data-tid')) {
					Merge.addTopic($(this).attr('data-tid'));
				}
				return false;
			});

			callback();
		});
	};

	Merge.addTopic = function (tid, callback) {
		callback = callback || function () {};
		socket.emit('topics.getTopic', tid, function (err, topicData) {
			if (err) {
				return alerts.error(err);
			}
			const title = topicData ? topicData.title : 'No title';
			if (selectedTids[tid]) {
				delete selectedTids[tid];
			} else {
				selectedTids[tid] = title;
			}
			checkButtonEnable();
			showTopicsSelected();
			callback();
		});
	};

	function onTopicClicked(ev) {
		if (!modal) {
			return;
		}
		const tid = $(this).parents('[component="category/topic"]').attr('data-tid');
		Merge.addTopic(tid);

		ev.preventDefault();
		ev.stopPropagation();
		return false;
	}

	function mergeTopics(btn) {
		btn.attr('disabled', true);
		const tids = Object.keys(selectedTids);
		const options = {};
		if (modal.find('.merge-main-topic-radio').is(':checked')) {
			options.mainTid = modal.find('.merge-main-topic-select').val();
		} else if (modal.find('.merge-new-title-radio').is(':checked')) {
			options.newTopicTitle = modal.find('.merge-new-title-input').val();
		}

		socket.emit('topics.merge', { tids: tids, options: options }, function (err, tid) {
			btn.removeAttr('disabled');
			if (err) {
				return alerts.error(err);
			}
			ajaxify.go('/topic/' + tid);
			closeModal();
		});
	}

	function showTopicsSelected() {
		if (!modal) {
			return;
		}
		const tids = Object.keys(selectedTids);
		tids.sort(function (a, b) {
			return a - b;
		});

		const topics = tids.map(function (tid) {
			return { tid: tid, title: selectedTids[tid] };
		});

		if (tids.length) {
			app.parseAndTranslate('partials/merge_topics_modal', {
				config: config,
				topics: topics,
			}, function (html) {
				modal.find('.topics-section').html(html.find('.topics-section').html());
				modal.find('.merge-main-topic-select').html(html.find('.merge-main-topic-select').html());
			});
		} else {
			modal.find('.topics-section').translateHtml('[[error:no-topics-selected]]');
		}
	}

	function checkButtonEnable() {
		if (Object.keys(selectedTids).length) {
			mergeBtn.removeAttr('disabled');
		} else {
			mergeBtn.attr('disabled', true);
		}
	}

	function closeModal() {
		if (modal) {
			modal.remove();
			modal = null;
		}
		selectedTids = {};
		$('#content').off('click', '[component="topic/select"]', onTopicClicked);
	}

	return Merge;
});
