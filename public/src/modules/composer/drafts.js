'use strict';

/* globals define */

define('composer/drafts', function() {

	var drafts = {};
	var	saveThrottleId;
	var saving = false;

	drafts.init = function(postContainer, postData) {

		var bodyEl = postContainer.find('textarea');
		bodyEl.on('keyup', function() {
			resetTimeout();

			saveThrottleId = setTimeout(function() {
				saveDraft(postContainer, postData);
			}, 1000);
		});
	};

	function resetTimeout() {
		if (saveThrottleId) {
			clearTimeout(saveThrottleId);
			saveThrottleId = 0;
		}
	}

	drafts.getDraft = function(save_id) {
		return localStorage.getItem(save_id);
	};

	function saveDraft(postContainer, postData) {
		var raw;

		if (canSave() && postData && postData.save_id && postContainer.length) {
			raw = postContainer.find('textarea').val();
			if (raw.length) {
				localStorage.setItem(postData.save_id, raw);
			} else {
				drafts.removeDraft(postData.save_id);
			}
		}
	}

	drafts.removeDraft = function(save_id) {
		resetTimeout();
		return localStorage.removeItem(save_id);
	};

	function canSave() {
		if (saving) {
			return saving;
		}

		try {
			localStorage.setItem('test', 'test');
			localStorage.removeItem('test');
			saving = true;
			return true;
		} catch(e) {
			saving = false;
			return false;
		}
	}

	return drafts;
});