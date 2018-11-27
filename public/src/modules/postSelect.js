'use strict';


define('postSelect', ['components'], function (components) {
	var PostSelect = {};
	var onSelect;

	PostSelect.pids = [];

	PostSelect.init = function (_onSelect) {
		PostSelect.pids.length = 0;
		onSelect = _onSelect;
		$('#content').on('click', '[component="topic"] [component="post"]', onPostClicked);
		disableClicksOnPosts();
	};

	function onPostClicked() {
		PostSelect.togglePostSelection($(this));
	}

	PostSelect.disable = function () {
		PostSelect.pids.forEach(function (pid) {
			components.get('post', 'pid', pid).toggleClass('bg-success', false);
		});

		$('#content').off('click', '[component="topic"] [component="post"]', onPostClicked);
		enableClicksOnPosts();
	};

	PostSelect.togglePostSelection = function (post) {
		var newPid = post.attr('data-pid');

		if (parseInt(post.attr('data-index'), 10) === 0) {
			return;
		}

		if (newPid) {
			var index = PostSelect.pids.indexOf(newPid);
			if (index === -1) {
				PostSelect.pids.push(newPid);
				post.toggleClass('bg-success', true);
			} else {
				PostSelect.pids.splice(index, 1);
				post.toggleClass('bg-success', false);
			}

			if (PostSelect.pids.length) {
				PostSelect.pids.sort(function (a, b) { return a - b; });
			}
			if (typeof onSelect === 'function') {
				onSelect();
			}
		}
	};


	function disableClicks() {
		return false;
	}

	function disableClicksOnPosts() {
		$('#content').on('click', '[component="post"] button, [component="post"] a', disableClicks);
	}

	function enableClicksOnPosts() {
		$('#content').off('click', '[component="post"] button, [component="post"] a', disableClicks);
	}

	return PostSelect;
});
