'use strict';

/* globals define, ajaxify, app, utils, socket, translator*/

define(['forum/accountheader'], function(header) {
	var Account = {};

	Account.init = function() {
		header.init();

		var yourid = ajaxify.variables.get('yourid'),
			theirid = ajaxify.variables.get('theirid'),
			isFollowing = ajaxify.variables.get('isFollowing');

		var username = $('.account-username').html();
		app.enterRoom('user/' + theirid);

		utils.addCommasToNumbers($('.account .formatted-number'));
		utils.makeNumbersHumanReadable($('.account .human-readable-number'));
		$('.user-recent-posts img').addClass('img-responsive');


		var isSelfOrNotLoggedIn = yourid === theirid || yourid === '0';
		$('#follow-btn').toggleClass('hide', isFollowing || isSelfOrNotLoggedIn);
		$('#unfollow-btn').toggleClass('hide', !isFollowing || isSelfOrNotLoggedIn);
		$('#chat-btn').toggleClass('hide', isSelfOrNotLoggedIn);

		$('#follow-btn').on('click', function() {
			return toggleFollow('follow');
		});

		$('#unfollow-btn').on('click', function() {
			return toggleFollow('unfollow');
		});

		$('#chat-btn').on('click', function() {
			app.openChat(username, theirid);
		});

		socket.on('user.isOnline', handleUserOnline);

		socket.emit('user.isOnline', theirid, handleUserOnline);
	};

	function toggleFollow(type) {
		socket.emit('user.' + type, {
			uid: ajaxify.variables.get('theirid')
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
