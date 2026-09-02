'use strict';


define('postSelect', ['components'], function (components) {
	const PostSelect = {};
	let onSelect;

	PostSelect.pids = [];

	let allowMainPostSelect = false;
	let lastSelectedPid;

	PostSelect.init = function (_onSelect, options) {
		PostSelect.pids.length = 0;
		lastSelectedPid = null;
		onSelect = _onSelect;
		options = options || {};
		allowMainPostSelect = options.allowMainPostSelect || false;
		$('#content').on('click', '[component="topic"] [component="post"]', onPostClicked);
		$('#content').on('selectstart', '[component="topic"] [component="post"]', preventSelectOnShift);
		disableClicksOnPosts();
	};

	function onPostClicked(ev) {
		ev.stopPropagation();
		const pidClicked = $(this).attr('data-pid');
		if (!isSelectable($(this))) {
			return;
		}

		if (ev.shiftKey && lastSelectedPid && lastSelectedPid !== pidClicked) {
			selectRange(pidClicked);
		} else {
			PostSelect.togglePostSelection(getPostEls(pidClicked), pidClicked);
		}
		lastSelectedPid = pidClicked;
	}

	function preventSelectOnShift(ev) {
		if (ev.shiftKey) {
			ev.preventDefault();
		}
	}

	PostSelect.disable = function () {
		PostSelect.pids.forEach(function (pid) {
			components.get('post', 'pid', pid).toggleClass('selected', false);
		});

		$('#content').off('click', '[component="topic"] [component="post"]', onPostClicked);
		$('#content').off('selectstart', '[component="topic"] [component="post"]', preventSelectOnShift);
		enableClicksOnPosts();
	};

	PostSelect.togglePostSelection = function (postEls, pid) {
		if (pid) {
			setPostSelection(pid, PostSelect.pids.indexOf(pid) === -1, postEls);
			onSelectionChanged();
		}
	};

	function setPostSelection(pid, isSelected, postEls) {
		const index = PostSelect.pids.indexOf(pid);
		if (isSelected === (index !== -1)) {
			return;
		}

		if (isSelected) {
			PostSelect.pids.push(pid);
		} else {
			PostSelect.pids.splice(index, 1);
		}
		(postEls || getPostEls(pid)).toggleClass('selected', isSelected);
	}

	// selects/deselects every loaded post between the previously clicked post and this one
	function selectRange(pidClicked) {
		const postEls = getSelectablePostEls();
		const start = indexOfPid(postEls, lastSelectedPid);
		const end = indexOfPid(postEls, pidClicked);
		if (start === -1 || end === -1) {
			PostSelect.togglePostSelection(getPostEls(pidClicked), pidClicked);
			return;
		}

		const isSelected = PostSelect.pids.indexOf(pidClicked) === -1;
		postEls.slice(Math.min(start, end), Math.max(start, end) + 1).each(function () {
			setPostSelection($(this).attr('data-pid'), isSelected, $(this));
		});
		onSelectionChanged();
	}

	function onSelectionChanged() {
		if (PostSelect.pids.length) {
			PostSelect.pids.sort(function (a, b) { return a - b; });
		}
		if (typeof onSelect === 'function') {
			onSelect();
		}
	}

	function isSelectable(postEl) {
		return allowMainPostSelect || parseInt(postEl.attr('data-index'), 10) !== 0;
	}

	function getPostEls(pid) {
		return $('[component="topic"] [data-pid="' + pid + '"]');
	}

	function getSelectablePostEls() {
		return $('[component="topic"] [component="post"]').filter(function () {
			return isSelectable($(this));
		});
	}

	function indexOfPid(postEls, pid) {
		return postEls.index(postEls.filter('[data-pid="' + pid + '"]').first());
	}

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
