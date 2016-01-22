'use strict';
/* globals config, io, ajaxify */

var app = app || {};
var socket;
app.isConnected = false;

(function () {
	var reconnecting = false;

	var ioParams = {
		reconnectionAttempts: config.maxReconnectionAttempts,
		reconnectionDelay: config.reconnectionDelay,
		transports: config.socketioTransports,
		path: config.relative_path + '/socket.io'
	};

	socket = io(config.websocketAddress, ioParams);

	socket.on('connect', onConnect);

	socket.on('reconnecting', onReconnecting);

	socket.on('disconnect', onDisconnect);

	socket.on('reconnect_failed', function() {
		// Wait ten times the reconnection delay and then start over
		setTimeout(socket.connect.bind(socket), parseInt(config.reconnectionDelay, 10) * 10);
	});

	socket.on('event:banned', onEventBanned);

	socket.on('event:alert', app.alert);

	function onConnect() {
		app.isConnected = true;

		if (!reconnecting) {
			app.showLoginMessage();
			$(window).trigger('action:connected');
		}

		if (reconnecting) {
			var reconnectEl = $('#reconnect');

			reconnectEl.tooltip('destroy');
			reconnectEl.html('<i class="fa fa-check"></i>');
			reconnecting = false;

			reJoinCurrentRoom();

			socket.emit('meta.reconnected');

			$(window).trigger('action:reconnected');

			setTimeout(function() {
				reconnectEl.removeClass('active').addClass('hide');
			}, 3000);
		}
	}

	function reJoinCurrentRoom() {
		var	url_parts = window.location.pathname.slice(config.relative_path.length).split('/').slice(1);
		var room;

		switch(url_parts[0]) {
			case 'user':
				room = 'user/' + (ajaxify.data ? ajaxify.data.theirid : 0);
			break;
			case 'topic':
				room = 'topic_' + url_parts[1];
			break;
			case 'category':
				room = 'category_' + url_parts[1];
			break;
			case 'recent':
				room = 'recent_topics';
			break;
			case 'unread':
				room = 'unread_topics';
			break;
			case 'popular':
				room = 'popular_topics';
			break;
			case 'admin':
				room = 'admin';
			break;
			case 'categories':
				room = 'categories';
			break;
		}
		app.currentRoom = '';
		app.enterRoom(room);
	}

	function onReconnecting() {
		reconnecting = true;
		var reconnectEl = $('#reconnect');

		if (!reconnectEl.hasClass('active')) {
			reconnectEl.html('<i class="fa fa-spinner fa-spin"></i>');
		}

		reconnectEl.addClass('active').removeClass("hide").tooltip({
			placement: 'bottom'
		});
	}

	function onDisconnect() {
		$(window).trigger('action:disconnected');
		app.isConnected = false;
	}

	function onEventBanned() {
		app.alert({
			title: '[[global:alert.banned]]',
			message: '[[global:alert.banned.message]]',
			type: 'danger',
			timeout: 1000
		});

		setTimeout(function() {
			window.location.href = config.relative_path + '/';
		}, 1000);
	}

}());