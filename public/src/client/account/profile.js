'use strict';


define('forum/account/profile', [
	'forum/account/header',
	'bootbox',
], function (header, bootbox) {
	const Account = {};

	Account.init = function () {
		header.init();

		app.enterRoom('user/' + ajaxify.data.theirid);

		processPage();

		if (parseInt(ajaxify.data.emailChanged, 10) === 1) {
			bootbox.alert('[[user:emailUpdate.change-instructions]]');
		}

		socket.removeListener('event:user_status_change', onUserStatusChange);
		socket.on('event:user_status_change', onUserStatusChange);
	};

	function processPage() {
		$('[component="posts"] [component="post/content"] img:not(.not-responsive), [component="aboutme"] img:not(.not-responsive)').addClass('img-responsive');
	}

	function onUserStatusChange(data) {
		if (parseInt(ajaxify.data.theirid, 10) !== parseInt(data.uid, 10)) {
			return;
		}

		app.updateUserStatus($('.account [data-uid="' + data.uid + '"] [component="user/status"]'), data.status);
	}

	return Account;
});
