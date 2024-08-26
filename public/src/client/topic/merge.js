'use strict';


define('forum/topic/merge', ['search', 'alerts', 'api'], function (search, alerts, api) {
	const Merge = {};
	let modal;
	let mergeBtn;

	let selectedTids = {};

	Merge.init = function (callback) {
		callback = callback || function () {};
		if (modal) {
			return;
		}
		app.parseAndTranslate('modals/merge-topic', {}, function (html) {
			modal = html;

			$('body').append(modal);

			mergeBtn = modal.find('#merge_topics_confirm');

			modal.find('#merge_topics_cancel').on('click', closeModal);

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
				dropdown: {
					maxWidth: '400px',
					maxHeight: '350px',
				},
			});
			modal.on('click', '[data-tid]', function () {
				const addTid = $(this).attr('data-tid');
				if (addTid) {
					Merge.addTopic(addTid);
				}
				return false;
			});
			modal.on('click', '[data-remove-tid]', function () {
				const removeTid = $(this).attr('data-remove-tid');
				if (removeTid) {
					Merge.removeTopic(removeTid);
				}
				return false;
			});

			callback();
		});
	};

	Merge.addTopic = function (tid, callback) {
		callback = callback || function () {};
		api.get(`/topics/${tid}`, {}).then(function (topicData) {
			const title = topicData ? topicData.title : 'No title';
			selectedTids[tid] = title;
			checkButtonEnable();
			showTopicsSelected();
			callback();
		}).catch(alerts.error);
	};

	Merge.removeTopic = function (tid) {
		if (selectedTids[tid]) {
			delete selectedTids[tid];
		}
		checkButtonEnable();
		showTopicsSelected();
	};

	function onTopicClicked(ev) {
		if (!modal) {
			return;
		}
		const topicEl = $(this).parents('[component="category/topic"]');
		const isSelected = topicEl.hasClass('selected');
		const tid = topicEl.attr('data-tid');
		if (isSelected) {
			Merge.addTopic(tid);
		} else {
			Merge.removeTopic(tid);
		}

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
			app.parseAndTranslate('modals/merge-topic', {
				config: config,
				topics: topics,
			}, function (html) {
				modal.find('.topics-section').html(html.find('.topics-section').html());
				modal.find('.merge-main-topic-select').html(
					html.find('.merge-main-topic-select').html()
				);
			});
		} else {
			modal.find('.topics-section').translateHtml('[[error:no-topics-selected]]');
			modal.find('.merge-main-topic-select').html('');
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
