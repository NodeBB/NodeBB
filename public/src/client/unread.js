'use strict';


define('forum/unread', ['topicSelect', 'components', 'topicList'], function (topicSelect, components, topicList) {
	var Unread = {};

	Unread.init = function () {
		app.enterRoom('unread_topics');

		topicList.init('unread');
		topicSelect.init();

		$('#markSelectedRead').on('click', function () {
			var tids = topicSelect.getSelectedTids();
			if (!tids.length) {
				return;
			}
			socket.emit('topics.markAsRead', tids, function (err) {
				if (err) {
					return app.alertError(err.message);
				}

				doneRemovingTids(tids);
			});
		});

		$('#markAllRead').on('click', function () {
			socket.emit('topics.markAllRead', function (err) {
				if (err) {
					return app.alertError(err.message);
				}

				app.alertSuccess('[[unread:topics_marked_as_read.success]]');

				$('[component="category"]').empty();
				$('[component="pagination"]').addClass('hidden');
				$('#category-no-topics').removeClass('hidden');
				$('.markread').addClass('hidden');
			});
		});

		$('.markread').on('click', '.category', function () {
			function getCategoryTids(cid) {
				var tids = [];
				components.get('category/topic', 'cid', cid).each(function () {
					tids.push($(this).attr('data-tid'));
				});
				return tids;
			}
			var cid = $(this).attr('data-cid');
			var tids = getCategoryTids(cid);

			socket.emit('topics.markCategoryTopicsRead', cid, function (err) {
				if (err) {
					return app.alertError(err.message);
				}

				doneRemovingTids(tids);
			});
		});
	};

	function doneRemovingTids(tids) {
		removeTids(tids);

		app.alertSuccess('[[unread:topics_marked_as_read.success]]');

		if (!$('[component="category"]').children().length) {
			$('#category-no-topics').removeClass('hidden');
			$('.markread').addClass('hidden');
		}
	}

	function removeTids(tids) {
		for (var i = 0; i < tids.length; i += 1) {
			components.get('category/topic', 'tid', tids[i]).remove();
		}
	}


	return Unread;
});
