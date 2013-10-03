define(['forum/accountheader'], function(header) {
	var	Followers = {};

	Followers.init = function() {
		header.init();

		var yourid = templates.get('yourid'),
			theirid = templates.get('theirid'),
			followersCount = templates.get('followersCount');


			if (parseInt(followersCount, 10) === 0) {
				$('#no-followers-notice').removeClass('hide');
			}

		app.addCommasToNumbers();
	};

	return Followers;
});