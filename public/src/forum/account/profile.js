'use strict';

/* globals define, ajaxify, app, utils, socket, translator*/

define('forum/account/profile', ['forum/account/header'], function(header) {
	var Account = {},
		yourid,
		theirid,
		isFollowing;

	Account.init = function() {
		header.init();

		yourid = ajaxify.variables.get('yourid');
		theirid = ajaxify.variables.get('theirid');
		isFollowing = ajaxify.variables.get('isFollowing');

		app.enterRoom('user/' + theirid);

		processPage();

		updateButtons();

		$('#follow-btn').on('click', function() {
			return toggleFollow('follow');
		});

		$('#unfollow-btn').on('click', function() {
			return toggleFollow('unfollow');
		});

		$('#chat-btn').on('click', function() {
			app.openChat($('.account-username').html(), theirid);
		});

		socket.on('user.isOnline', handleUserOnline);

		if (yourid !== theirid) {
			socket.emit('user.increaseViewCount', theirid);
		}
	};

	function processPage() {
		$('.user-recent-posts img, .post-signature img').addClass('img-responsive');
	}

	function updateButtons() {
		var isSelfOrNotLoggedIn = yourid === theirid || parseInt(yourid, 10) === 0;
		$('#follow-btn').toggleClass('hide', isFollowing || isSelfOrNotLoggedIn);
		$('#unfollow-btn').toggleClass('hide', !isFollowing || isSelfOrNotLoggedIn);
		$('#chat-btn').toggleClass('hide', isSelfOrNotLoggedIn);
	}

	function toggleFollow(type) {
		socket.emit('user.' + type, {
			uid: theirid
		}, function(err) {
			if(err) {
				return app.alertError(err.message);
			}

			$('#follow-btn').toggleClass('hide', type === 'follow');
			$('#unfollow-btn').toggleClass('hide', type === 'unfollow');
			app.alertSuccess('[[global:alert.' + type + ', ' + $('.account-username').html() + ']]');
		});
		return false;
	}

	function handleUserOnline(err, data) {
		if (err) {
			return app.alertError(err.message);
		}

		var onlineStatus = $('.account-online-status');

		if(parseInt(ajaxify.variables.get('theirid'), 10) !== parseInt(data.uid, 10)) {
			return;
		}

		translator.translate('[[global:' + data.status + ']]', function(translated) {
			onlineStatus.attr('class', 'account-online-status fa fa-circle status ' + data.status)
				.attr('title', translated)
				.attr('data-original-title', translated);
		});

	}

	return Account;
});
