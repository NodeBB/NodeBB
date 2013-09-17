(function() {

	var yourid = templates.get('yourid'),
		theirid = templates.get('theirid'),
		followingCount = templates.get('followingCount');

	$(document).ready(function() {

		if (parseInt(followingCount, 10) === 0) {
			$('#no-following-notice').removeClass('hide');
		}


		if (yourid !== theirid) {
			$('.unfollow-btn').hide();
		} else {
			$('.unfollow-btn').on('click', function() {
				var unfollowBtn = $(this);
				var followingUid = $(this).attr('followingUid');

				socket.emit('api:user.unfollow', {
					uid: followingUid
				}, function(success) {
					var username = unfollowBtn.attr('data-username');
					if (success) {
						unfollowBtn.parent().remove();
						app.alertSuccess('You are no longer following ' + username + '!');
					} else {
						app.alertError('There was an error unfollowing ' + username + '!');
					}
				});
				return false;
			});
		}

		app.addCommasToNumbers();
	});


}());