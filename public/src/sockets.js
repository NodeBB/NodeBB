'use strict';

const io = require('socket.io-client');
const $ = require('jquery');

const { alert } = require('alerts');
const hooks = require('hooks');

app = window.app || {};

(function () {
	let reconnecting = false;

	const ioParams = {
		reconnectionAttempts: config.maxReconnectionAttempts,
		reconnectionDelay: config.reconnectionDelay,
		transports: config.socketioTransports,
		autoConnect: false,
		path: config.relative_path + '/socket.io',
		query: {
			_csrf: config.csrf_token,
		},
	};

	window.socket = io(config.websocketAddress, ioParams);

	const oEmit = socket.emit;
	socket.emit = function (event, data, callback) {
		if (typeof data === 'function') {
			callback = data;
			data = null;
		}
		if (typeof callback === 'function') {
			oEmit.apply(socket, [event, data, callback]);
			return;
		}

		return new Promise(function (resolve, reject) {
			oEmit.apply(socket, [event, data, function (err, result) {
				if (err) reject(err);
				else resolve(result);
			}]);
		});
	};
	let hasInteracted = false;

	function onInteraction() {
		if (!hasInteracted && parseInt(app.user.uid, 10) >= 0) {
			hasInteracted = true;
			addHandlers();
			socket.connect();
			document.removeEventListener('mousemove', onInteraction);
			document.removeEventListener('keydown', onInteraction);
			document.removeEventListener('touchstart', onInteraction);
		}
	}
	document.addEventListener('mousemove', onInteraction);
	document.addEventListener('keydown', onInteraction);
	document.addEventListener('touchstart', onInteraction);


	window.app.reconnect = (showAlert = false) => {
		if (socket.connected || parseInt(app.user.uid, 10) < 0) {
			return;
		}

		if (showAlert) {
			$('#reconnect-alert')
				.removeClass('alert-danger alert-success pointer hide')
				.addClass('alert-warning show')
				.find('p')
				.translateText(`[[global:reconnecting-message, ${config.siteTitle}]]`);
		}

		$('#reconnect').html('<i class="fa fa-spinner fa-spin"></i>');
		socket.connect();
	};

	function addHandlers() {
		socket.on('connect', onConnect);
		socket.on('connect_error', function (err) {
			console.error('[socket.io] Connection error:', err);
		});
		socket.on('disconnect', onDisconnect);

		socket.io.on('reconnect_failed', function () {
			const reconnectEl = $('#reconnect');
			reconnectEl.html('<i class="fa fa-plug text-danger"></i>');

			$('#reconnect-alert')
				.removeClass('alert-warning alert-success hide')
				.addClass('alert-danger pointer show')
				.find('p')
				.translateText('[[error:socket-reconnect-failed]]')
				.one('click', () => app.reconnect(true));

			$(window).one('focus', () => app.reconnect(true));
		});

		socket.on('checkSession', function (uid) {
			if (parseInt(uid, 10) !== parseInt(app.user.uid, 10)) {
				handleSessionMismatch();
			}
		});
		socket.on('event:invalid_session', () => {
			handleInvalidSession();
		});

		socket.on('setHostname', function (hostname) {
			app.upstreamHost = hostname;
		});

		socket.on('event:banned', onEventBanned);
		socket.on('event:unbanned', onEventUnbanned);
		socket.on('event:logout', function () {
			require(['logout'], function (logout) {
				logout();
			});
		});
		socket.on('event:alert', params => alert(params));
		socket.on('event:deprecated_call', (data) => {
			console.warn('[socket.io]', data.eventName, 'is now deprecated', data.replacement ? `in favour of ${data.replacement}` : 'with no alternative planned.');
		});

		socket.on('event:livereload', function () {
			if (app.user.isAdmin && !ajaxify.currentPage.match(/admin/)) {
				window.location.reload();
			}
		});
	}

	function handleInvalidSession() {
		socket.disconnect();
		require(['messages', 'logout'], function (messages, logout) {
			logout(false);
			messages.showInvalidSession();
		});
	}

	function handleSessionMismatch() {
		if (app.flags._login || app.flags._logout) {
			return;
		}

		socket.disconnect();
		require(['messages'], function (messages) {
			messages.showSessionMismatch();
		});
	}

	async function onConnect() {
		if (!reconnecting) {
			hooks.fire('action:connected');
		} else {
			const reconnectEl = $('#reconnect');
			const reconnectAlert = $('#reconnect-alert');

			reconnectEl.tooltip('dispose');
			reconnectEl.html('<i class="fa fa-check text-success"></i>');

			reconnectAlert
				.removeClass('alert-warning alert-danger')
				.addClass('alert-success')
				.find('p')
				.translateText(`[[global:reconnected-message, ${config.siteTitle}]]`);

			setTimeout(() => {
				reconnectEl.removeClass('active').addClass('hide');
				reconnectAlert.removeClass('show').addClass('hide');
			}, 3000);


			reconnecting = false;

			reJoinCurrentRoom();

			const { 'cache-buster': hash, hostname } = await socket.emit('meta.reconnected');
			if ((hostname === app.upstreamHost) && (!app.cacheBuster || app.cacheBuster !== hash)) {
				app.cacheBuster = hash;
				alert({
					alert_id: 'forum_updated',
					title: '[[global:updated.title]]',
					message: '[[global:updated.message]]',
					clickfn: function () {
						window.location.reload();
					},
					type: 'warning',
				});
			}

			hooks.fire('action:reconnected');
		}
	}

	function reJoinCurrentRoom() {
		if (app.currentRoom) {
			const current = app.currentRoom;
			app.currentRoom = '';
			app.enterRoom(current);
		}
		if (ajaxify.data.template.chats) {
			if (ajaxify.data.roomId) {
				socket.emit('modules.chats.enter', ajaxify.data.roomId);
			}
			if (ajaxify.data.publicRooms) {
				socket.emit('modules.chats.enterPublic', ajaxify.data.publicRooms.map(r => r.roomId));
			}
		}
	}

	function onReconnecting() {
		const reconnectEl = $('#reconnect');
		if (!reconnectEl.hasClass('active')) {
			reconnectEl.html('<i class="fa fa-spinner fa-spin"></i>');
		}

		reconnectEl.addClass('active').removeClass('hide').tooltip({
			placement: 'bottom',
			animation: false,
		});
	}

	function onDisconnect() {
		reconnecting = true;
		setTimeout(function () {
			if (!socket.connected) {
				onReconnecting();
			}
		}, 5000);

		hooks.fire('action:disconnected');
	}

	function onEventBanned(data) {
		require(['bootbox', 'translator'], function (bootbox, translator) {
			const message = data.until ?
				translator.compile('error:user-banned-reason-until', (new Date(data.until).toLocaleString()), data.reason) :
				'[[error:user-banned-reason, ' + data.reason + ']]';
			translator.translate(message, function (message) {
				bootbox.alert({
					title: '[[error:user-banned]]',
					message: message,
					closeButton: false,
					callback: function () {
						window.location.href = config.relative_path + '/';
					},
				});
			});
		});
	}

	function onEventUnbanned() {
		require(['bootbox'], function (bootbox) {
			bootbox.alert({
				title: '[[global:alert.unbanned]]',
				message: '[[global:alert.unbanned.message]]',
				closeButton: false,
				callback: function () {
					window.location.href = config.relative_path + '/';
				},
			});
		});
	}

	if (
		config.socketioOrigins &&
		config.socketioOrigins !== '*:*' &&
		config.socketioOrigins.indexOf(location.hostname) === -1
	) {
		console.error(
			'You are accessing the forum from an unknown origin. This will likely result in websockets failing to connect. \n' +
			'To fix this, set the `"url"` value in `config.json` to the URL at which you access the site. \n' +
			'For more information, see this FAQ topic: https://community.nodebb.org/topic/13388'
		);
	}
}());
