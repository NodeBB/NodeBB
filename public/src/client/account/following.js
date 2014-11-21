define('forum/account/following', ['forum/account/header'], function(header) {
	var	Following = {};

	Following.init = function() {
		header.init();

		var followingCount = ajaxify.variables.get('followingCount');

		if (parseInt(followingCount, 10) === 0) {
			$('#no-following-notice').removeClass('hide');
		}
	};

	return Following;
});
