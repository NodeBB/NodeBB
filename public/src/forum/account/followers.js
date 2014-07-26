define('forum/account/followers', ['forum/account/header'], function(header) {
	var	Followers = {};

	Followers.init = function() {
		header.init();

		var yourid = ajaxify.variables.get('yourid'),
			theirid = ajaxify.variables.get('theirid'),
			followersCount = ajaxify.variables.get('followersCount');


		if (parseInt(followersCount, 10) === 0) {
			$('#no-followers-notice').removeClass('hide');
		}

	};

	return Followers;
});
