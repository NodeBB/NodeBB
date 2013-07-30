(function() {

	var yourid = templates.get('yourid'),
		theirid = templates.get('theirid'),
		followingCount = templates.get('followingCount');

	$(document).ready(function() {
		
		if(parseInt(followingCount, 10) === 0) {
			$('#no-following-notice').show();
		}


		if(yourid !== theirid) {
			$('.unfollow-btn').hide();
		}
		else {
			$('.unfollow-btn').on('click',function() {
				var unfollowBtn = $(this);
				var followingUid = $(this).attr('followingUid');
			
				socket.emit('api:user.unfollow', {uid: followingUid}, function(success) {
					var username = unfollowBtn.attr('data-username');
					if(success) {
						unfollowBtn.parent().remove();
						app.alert({
							title: 'Unfollowing',
							message: 'You are no longer following ' + username + '!',
							type: 'success',
							timeout: 2000
						});		
					} else {
						app.alert({
							title: 'Error',
							message: 'There was an error unfollowing ' + username + '!',
							type: 'error',
							timeout: 2000
						});		
					}
				});
				return false;
			});
		}

		$('.reputation').each(function(index, element) {
			$(element).html(app.addCommas($(element).html()));
		});
		
		$('.postcount').each(function(index, element) {
			$(element).html(app.addCommas($(element).html()));
		});
		
	});
	

}());