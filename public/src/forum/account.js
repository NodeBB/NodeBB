(function() {
	var yourid = templates.get('yourid'),
		theirid = templates.get('theirid'),
		isFollowing = templates.get('isFollowing');

	$(document).ready(function() {

		var rep = $('#reputation');
		rep.html(app.addCommas(rep.html()));
		
		var postcount = $('#postcount');
		postcount.html(app.addCommas(postcount.html()));
		
		var followBtn = $('#follow-btn');
		var unfollowBtn = $('#unfollow-btn');

		if(yourid !== theirid) {
			if(isFollowing) {
				followBtn.hide();
				unfollowBtn.show();
			} else {
				followBtn.show();
				unfollowBtn.hide();
			}
		}

		followBtn.on('click', function() {
			socket.emit('api:user.follow', {uid: theirid}, function(success) {
				var username = $('.account-username a').html();
				if(success) {
					followBtn.hide();
					unfollowBtn.show();
					app.alert({
						title: 'Following',
						message: 'You are now following ' + username + '!',
						type: 'success',
						timeout: 2000
					});		
				} else {
					app.alert({
						title: 'Error',
						message: 'There was an error following' + username + '!',
						type: 'error',
						timeout: 2000
					});		
				}
			});
			return false;
		});

		unfollowBtn.on('click', function() {
			socket.emit('api:user.unfollow', {uid: theirid}, function(success) {
				var username = $('.account-username a').html();
				if(success) {
					followBtn.show();
					unfollowBtn.hide();
					app.alert({
						title: 'Unfollowing',
						message: 'You are no longer following ' + username + '!',
						type: 'success',
						timeout: 2000
					});		
				} else {
					app.alert({
						title: 'Error',
						message: 'There was an error unfollowing' + username + '!',
						type: 'error',
						timeout: 2000
					});		
				}
			});
			return false;
		});

		$('.user-recent-posts .topic-row').on('click', function() {
			ajaxify.go($(this).attr('topic-url'));
		});
		
		var onlineStatus = $('.account-online-status');
		
		socket.on('api:user.isOnline', function(online) {
			if(online) {
				onlineStatus.find('span span').text('online');
				onlineStatus.find('i').attr('class', 'icon-circle');
			} else {
				onlineStatus.find('span span').text('offline');
				onlineStatus.find('i').attr('class', 'icon-circle-blank');
			}
		});
		
		socket.emit('api:user.isOnline', theirid);

	});

}());