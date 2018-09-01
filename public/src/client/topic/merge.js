'use strict';


define('forum/topic/merge', function () {
	var Merge = {};
	var modal;
	var mergeBtn;

	var selectedTids = {};

	Merge.init = function () {
		$('.category').on('click', '[component="topic/merge"]', onMergeTopicsClicked);
	};

	function onMergeTopicsClicked() {
		if (modal) {
			return;
		}
		app.parseAndTranslate('partials/merge_topics_modal', {}, function (html) {
			modal = html;

			$('body').append(modal);

			mergeBtn = modal.find('#merge_topics_confirm');

			modal.find('.close,#merge_topics_cancel').on('click', closeModal);

			$('#content').on('click', '[component="category"] [component="category/topic"] a', onTopicClicked);

			showTopicsSelected();

			mergeBtn.on('click', function () {
				mergeTopics(mergeBtn);
			});
		});
	}

	function onTopicClicked(ev) {
		var tid = $(this).parents('[component="category/topic"]').attr('data-tid');
		socket.emit('topics.getTopic', tid, function (err, topicData) {
			if (err) {
				return app.alertError(err);
			}
			var title = topicData ? topicData.title : 'No title';
			if (selectedTids[tid]) {
				delete selectedTids[tid];
			} else {
				selectedTids[tid] = title;
			}
			checkButtonEnable();
			showTopicsSelected();
		});
		ev.preventDefault();
		ev.stopPropagation();
		return false;
	}

	function mergeTopics(btn) {
		btn.attr('disabled', true);
		var tids = Object.keys(selectedTids);
		socket.emit('topics.merge', tids, function (err) {
			btn.removeAttr('disabled');
			if (err) {
				return app.alertError(err.message);
			}
			ajaxify.go('/topic/' + tids[0]);
			closeModal();
		});
	}

	function showTopicsSelected() {
		var tids = Object.keys(selectedTids);
		tids.sort(function (a, b) {
			return a - b;
		});

		var topics = tids.map(function (tid) {
			return { tid: tid, title: selectedTids[tid] };
		});

		if (tids.length) {
			app.parseAndTranslate('partials/merge_topics_modal', 'topics', { topics: topics }, function (html) {
				modal.find('.topics-section').html(html);
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
		$('#content').off('click', '[component="category"] [component="category/topic"] a', onTopicClicked);
	}

	return Merge;
});
