'use strict';

/* globals define*/

define('postSelect', ['components'], function(components) {
	var PostSelect = {};

	PostSelect.pids = [];

	PostSelect.init = function(onSelect) {
		PostSelect.pids.length = 0;
		components.get('topic').on('click', '[data-pid]', function() {
			togglePostSelection($(this), onSelect);
		});
		disableClicksOnPosts();
	};


	function togglePostSelection(post, callback) {
		var newPid = post.attr('data-pid');

		if (parseInt(post.attr('data-index'), 10) === 0) {
			return;
		}

		if (newPid) {
			var index = PostSelect.pids.indexOf(newPid);
			if(index === -1) {
				PostSelect.pids.push(newPid);
				post.css('opacity', '0.5');
			} else {
				PostSelect.pids.splice(index, 1);
				post.css('opacity', '1.0');
			}

			if (PostSelect.pids.length) {
				PostSelect.pids.sort(function(a,b) { return a - b; });
			}
			callback();
		}
	}


	function disableClicks() {
		return false;
	}

	function disableClicksOnPosts() {
		components.get('post').on('click', 'button,a', disableClicks);
	}

	PostSelect.enableClicksOnPosts = function() {
		components.get('post').off('click', 'button,a', disableClicks);
	};



	return PostSelect;
});