var socket,
	config,
	app = {
		'username': null,
		'uid': null
	};

(function () {
	var showWelcomeMessage = false;


	app.loadConfig = function() {

		$.ajax({
			url: RELATIVE_PATH + '/api/config',
			success: function (data) {
				config = data;
				if(socket) {
					socket.disconnect();
					setTimeout(function() {
						socket.socket.connect();
					}, 200);
				} else {
					var max_reconnection_attemps = 5;
					var reconnection_delay = 200;
					socket = io.connect(RELATIVE_PATH, {
						'max reconnection attempts': max_reconnection_attemps,
						'reconnection delay': reconnection_delay
					});

					var reconnecting = false,
						reconnectEl, reconnectTimer;

					socket.on('event:connect', function (data) {
						app.username = data.username;
						app.uid = data.uid;

						app.showLoginMessage();
						socket.emit('api:updateHeader', {
							fields: ['username', 'picture', 'userslug']
						});
					});

					socket.on('event:alert', function (data) {
						app.alert(data);
					});

					socket.on('connect', function (data) {
						if (reconnecting) {
							reconnectEl.html('<i class="icon-ok"></i> Connected!');
							reconnecting = false;

							setTimeout(function() {
								reconnectEl.removeClass('active');
							}, 3000);
						}

						socket.emit('api:updateHeader', {
							fields: ['username', 'picture', 'userslug']
						});
					});

					socket.on('event:disconnect', function() {
						socket.socket.connect();
					});

					socket.on('reconnecting', function (data, attempt) {
						if(attempt == max_reconnection_attemps) {
							socket.socket.reconnectionAttempts = 0;
							socket.socket.reconnectionDelay = reconnection_delay;
							return;
						}

						if (!reconnectEl) reconnectEl = $('#reconnect');
						reconnecting = true;

						reconnectEl.addClass('active');
						reconnectEl.html('<i class="icon-spinner icon-spin"></i> Reconnecting...');
					});

					socket.on('api:user.get_online_users', function (users) {
						jQuery('a.username-field').each(function () {
							if (this.processed === true)
								return;

							var el = jQuery(this),
								uid = el.parents('li').attr('data-uid');

							if (uid && jQuery.inArray(uid, users) !== -1) {
								el.find('i').remove();
								el.prepend('<i class="icon-circle"></i>');
							} else {
								el.find('i').remove();
								el.prepend('<i class="icon-circle-blank"></i>');
							}

							el.processed = true;
						});
						jQuery('button .username-field').each(function () {
							//DRY FAIL
							if (this.processed === true)
								return;

							var el = jQuery(this),
								uid = el.parents('li').attr('data-uid');

							if (uid && jQuery.inArray(uid, users) !== -1) {
								el.parent().addClass('btn-success');
							} else {
								el.parent().addClass('btn-danger');
							}

							el.processed = true;
						});
					});

					socket.on('event:banned', function() {
						app.alert({
							title: 'Banned',
							message: 'You are banned you will be logged out!',
							type: 'warning',
							timeout: 1000
						});

						setTimeout(app.logout, 1000);
					});

					app.enter_room('global');
				}
			},
			async: false
		});
	}

	app.logout = function() {
		$.post(RELATIVE_PATH + '/logout', {
			_csrf: $('#csrf_token').val()
		}, function() {
			window.location.reload(false);
		});
	}

	// takes a string like 1000 and returns 1,000
	app.addCommas = function (text) {
		return text.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
	}

	// Willingly stolen from: http://phpjs.org/functions/strip_tags/
	app.strip_tags = function (input, allowed) {
		allowed = (((allowed || "") + "").toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join(''); // making sure the allowed arg is a string containing only tags in lowercase (<a><b><c>)
		var tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
			commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;

		return input.replace(commentsAndPhpTags, '').replace(tags, function ($0, $1) {
			return allowed.indexOf('<' + $1.toLowerCase() + '>') > -1 ? $0 : '';
		});
	}

	// use unique alert_id to have multiple alerts visible at a time, use the same alert_id to fade out the current instance
	// type : error, success, info, warning/notify
	// title = bolded title text
	// message = alert message content
	// timeout default = permanent
	// location : alert_window (default) or content
	app.alert = function (params) {
		var alert_id = 'alert_button_' + ((params.alert_id) ? params.alert_id : new Date().getTime());

		var alert = $('#' + alert_id);
		var title = params.title || '';

		function startTimeout(div, timeout) {
			var timeoutId = setTimeout(function () {
				$(div).fadeOut(1000, function () {
					$(this).remove();
				});
			}, timeout);

			$(div).attr('timeoutId', timeoutId);
		}

		if (alert.length > 0) {
			alert.find('strong').html(title);
			alert.find('p').html(params.message);
			alert.attr('class', "alert toaster-alert " + "alert-" + params.type);

			clearTimeout(alert.attr('timeoutId'));
			startTimeout(alert, params.timeout);
		} else {
			var div = document.createElement('div'),
				button = document.createElement('button'),
				strong = document.createElement('strong'),
				p = document.createElement('p');

			p.innerHTML = params.message;
			strong.innerHTML = title;

			div.className = "alert toaster-alert " + "alert-" + params.type;

			div.setAttribute('id', alert_id);
			div.appendChild(button);
			div.appendChild(strong);
			div.appendChild(p);

			button.className = 'close';
			button.innerHTML = '&times;';
			button.onclick = function (ev) {
				div.parentNode.removeChild(div);
			}

			if (params.location == null)
				params.location = 'alert_window';

			jQuery('#' + params.location).prepend(jQuery(div).fadeIn('100'));

			if (params.timeout) {
				startTimeout(div, params.timeout);
			}

			if (params.clickfn) {
				div.onclick = function () {
					params.clickfn();
					jQuery(div).fadeOut(500, function () {
						this.remove();
					});
				}
			}
		}
	}

	app.alertSuccess = function (message, timeout) {
		if (!timeout)
			timeout = 2000;

		app.alert({
			title: 'Success',
			message: message,
			type: 'success',
			timeout: timeout
		});
	}

	app.alertError = function (message, timeout) {
		if (!timeout)
			timeout = 2000;

		app.alert({
			title: 'Error',
			message: message,
			type: 'danger',
			timeout: timeout
		});
	}

	app.current_room = null;
	app.enter_room = function (room) {
		if (socket) {
			if (app.current_room === room)
				return;

			socket.emit('event:enter_room', {
				'enter': room,
				'leave': app.current_room
			});

			app.current_room = room;
		}
	};

	app.populate_online_users = function () {
		var uids = [];

		jQuery('.post-row').each(function () {
			uids.push(this.getAttribute('data-uid'));
		});

		socket.emit('api:user.get_online_users', uids);
	}

	app.process_page = function () {
		app.populate_online_users();

		var path = window.location.pathname,
			parts = path.split('/'),
			active = parts[parts.length - 1];

		jQuery('#main-nav li').removeClass('active');
		if (active) {
			jQuery('#main-nav li a').each(function () {
				var href = this.getAttribute('href');
				if (active == "sort-posts" || active == "sort-reputation" || active == "search" || active == "latest" || active == "online")
					active = 'users';
				if (href && href.match(active)) {
					jQuery(this.parentNode).addClass('active');
					return false;
				}
			});
		}

		$('span.timeago').timeago();
		$('.post-content img').addClass('img-responsive');

		setTimeout(function () {
			window.scrollTo(0, 1); // rehide address bar on mobile after page load completes.
		}, 100);
	}

	app.showLoginMessage = function () {
		function showAlert() {
			app.alert({
				type: 'success',
				title: 'Welcome Back ' + app.username + '!',
				message: 'You have successfully logged in!',
				timeout: 5000
			});
		}

		if (showWelcomeMessage) {
			showWelcomeMessage = false;
			if (document.readyState !== 'complete') {
				$(document).ready(showAlert);
			} else {
				showAlert();
			}
		}
	}

	app.addCommasToNumbers = function () {
		$('.formatted-number').each(function (index, element) {
			$(element).html(app.addCommas($(element).html()));
		});
	}

	app.openChat = function (username, touid) {
		if (username === app.username) {
			app.alert({
				type: 'warning',
				title: 'Invalid Chat',
				message: "You can't chat with yourself!",
				timeout: 5000
			});

			return;
		}

		if (!app.username) {
			app.alert({
				type: 'danger',
				title: 'Not Logged In',
				message: 'Please log in to chat with <strong>' + username + '</strong>',
				timeout: 5000
			});

			return;
		}

		require(['chat'], function (chat) {
			var chatModal;
			if (!chat.modalExists(touid)) {
				chatModal = chat.createModal(username, touid);
			} else {
				chatModal = chat.getModal(touid);
			}
			chat.load(chatModal.attr('UUID'));
			chat.center(chatModal);
		});
	}

	app.createNewPosts = function (data, infiniteLoaded) {
		if(!data || (data.posts && !data.posts.length))
			return;

		if (data.posts[0].uid !== app.uid) {
			data.posts[0].display_moderator_tools = 'none';
		}

		function removeAlreadyAddedPosts() {
			data.posts = data.posts.filter(function(post) {
				return $('#post-container li[data-pid="' + post.pid +'"]').length === 0;
			});
		}

		function findInsertionPoint() {
			var after = null,
				firstPid = data.posts[0].pid;
			$('#post-container li[data-pid]').each(function() {
				if(parseInt(firstPid, 10) > parseInt($(this).attr('data-pid'), 10))
				after = $(this);
			else
				return false;
			});
			return after;
		}

		removeAlreadyAddedPosts();
		if(!data.posts.length)
			return;
		var insertAfter = findInsertionPoint();

		var html = templates.prepare(templates['topic'].blocks['posts']).parse(data);
		translator.translate(html, function(translatedHTML) {
			var translated = $(translatedHTML);
			if(!infiniteLoaded) {
				translated.removeClass('infiniteloaded');
			}

			translated.insertAfter(insertAfter)
				.hide()
				.fadeIn('slow');

			for (var x = 0, numPosts = data.posts.length; x < numPosts; x++) {
				socket.emit('api:post.privileges', data.posts[x].pid);
			}

			app.infiniteLoaderActive = false;

			app.populate_online_users();
			app.addCommasToNumbers();
			$('span.timeago').timeago();
			$('.post-content img').addClass('img-responsive');
		});
	}

	app.infiniteLoaderActive = false;

	app.loadMorePosts = function (tid, callback) {
		if (app.infiniteLoaderActive) {
			return;
		}

		app.infiniteLoaderActive = true;

		if ($('#loading-indicator').attr('done') === '0') {
			$('#loading-indicator').removeClass('hide');
		}

		socket.emit('api:topic.loadMore', {
			tid: tid,
			after: $('#post-container .post-row.infiniteloaded').length
		}, function (data) {
			app.infiniteLoaderActive = false;
			if (data.posts.length) {
				$('#loading-indicator').attr('done', '0');
				app.createNewPosts(data, true);
			} else {
				$('#loading-indicator').attr('done', '1');
			}
			$('#loading-indicator').addClass('hide');
			if (callback)
				callback(data.posts);
		});
	}

	app.scrollToTop = function () {
		$('body,html').animate({
			scrollTop: 0
		});
	};

	app.scrollToBottom = function () {
		$('body,html').animate({
			scrollTop: $('html').height() - 100
		});
	}

	app.scrollToPost = function (pid) {
		if (!pid) {
			return;
		}

		var container = $(document.body),
			scrollTo = $('#post_anchor_' + pid),
			tid = $('#post-container').attr('data-tid');

		function animateScroll() {
			$('body,html').animate({
				scrollTop: scrollTo.offset().top - container.offset().top + container.scrollTop() - $('#header-menu').height()
			}, 400);
		}

		if (!scrollTo.length && tid) {

			var intervalID = setInterval(function () {
				app.loadMorePosts(tid, function (posts) {
					scrollTo = $('#post_anchor_' + pid);

					if (tid && scrollTo.length) {
						animateScroll();
					}

					if (!posts.length || scrollTo.length)
						clearInterval(intervalID);
				});
			}, 100);

		} else if (tid) {
			animateScroll();
		}

	}

	jQuery('document').ready(function () {
		$('#search-form').on('submit', function () {
			var input = $(this).find('input');
			ajaxify.go("search/" + input.val(), null, "search");
			input.val('');
			return false;
		});
	});

	showWelcomeMessage = location.href.indexOf('loggedin') !== -1;

	app.loadConfig();

}());