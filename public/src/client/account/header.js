'use strict';
/* globals define, app, ajaxify, socket, RELATIVE_PATH */

define('forum/account/header', [
	'coverPhoto',
	'uploader',
	'components'
], function(coverPhoto, uploader, components) {
	var	AccountHeader = {},
		yourid,
		theirid;

	AccountHeader.init = function() {
		yourid = ajaxify.data.yourid;
		theirid = ajaxify.data.theirid;

		hidePrivateLinks();
		selectActivePill();

		if (parseInt(yourid, 10) === parseInt(theirid, 10)) {
			setupCoverPhoto();
		}

		components.get('account/follow').on('click', function() {
			return toggleFollow('follow');
		});

		components.get('account/unfollow').on('click', function() {
			return toggleFollow('unfollow');
		});

		components.get('account/chat').on('click', function() {
			app.openChat($('.account-username').html(), theirid);
		});
	};

	function hidePrivateLinks() {
		if (!app.user.uid || app.user.uid !== parseInt(ajaxify.data.theirid, 10)) {
			$('.account-sub-links .plugin-link.private').addClass('hide');
		}
	}

	function selectActivePill() {
		$('.account-sub-links li').removeClass('active').each(function() {
			var href = $(this).find('a').attr('href');

			if (decodeURIComponent(href) === decodeURIComponent(window.location.pathname)) {
				$(this).addClass('active');
				return false;
			}
		});
	}

	function setupCoverPhoto() {
		coverPhoto.init(components.get('account/cover'),
			function(imageData, position, callback) {
				socket.emit('user.updateCover', {
					uid: yourid,
					imageData: imageData,
					position: position
				}, callback);
			},
			function() {
				uploader.open(RELATIVE_PATH + '/api/user/' + ajaxify.data.userslug + '/uploadcover', { uid: yourid }, 0, function(imageUrlOnServer) {
					components.get('account/cover').css('background-image', 'url(' + imageUrlOnServer + ')');
				});
			}
		);
	}

	function toggleFollow(type) {
		socket.emit('user.' + type, {
			uid: theirid
		}, function(err) {
			if (err) {
				return app.alertError(err.message);
			}

			$('#follow-btn').toggleClass('hide', type === 'follow');
			$('#unfollow-btn').toggleClass('hide', type === 'unfollow');
			app.alertSuccess('[[global:alert.' + type + ', ' + $('.account-username').html() + ']]');
		});
		return false;
	}

	return AccountHeader;
});
