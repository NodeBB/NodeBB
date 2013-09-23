var socket,
	config,
	app = {},
	API_URL = null;


(function() {
	var showWelcomeMessage = false;

	function loadConfig() {

		$.ajax({
			url: RELATIVE_PATH + '/api/config',
			success: function(data) {
				API_URL = data.api_url;

				config = data;
				socket = io.connect(config.socket.address);

				var reconnecting = false;
				var reconnectTries = 0;

				socket.on('event:connect', function(data) {
					console.log('connected to nodebb socket: ', data);
					app.username = data.username;
					app.showLoginMessage();
				});

				socket.on('event:alert', function(data) {
					app.alert(data);
				});

				socket.on('connect', function(data) {
					if (reconnecting) {
						setTimeout(function() {
							app.alert({
								alert_id: 'connection_alert',
								title: 'Connected',
								message: 'Connection successful.',
								type: 'success',
								timeout: 5000
							});
						}, 1000);
						reconnecting = false;
						reconnectTries = 0;
						socket.emit('api:updateHeader', {
							fields: ['username', 'picture', 'userslug']
						});
					}
				});

				socket.on('reconnecting', function(data) {
					function showDisconnectModal() {
						$('#disconnect-modal').modal({
							backdrop: 'static',
							show: true
						});

						$('#reload-button').on('click', function() {
							$('#disconnect-modal').modal('hide');
							window.location.reload();
						});
					}

					reconnecting = true;
					reconnectTries++;

					if (reconnectTries > 4) {
						showDisconnectModal();
						return;
					}

					app.alert({
						alert_id: 'connection_alert',
						title: 'Reconnecting',
						message: 'You have disconnected from NodeBB, we will try to reconnect you. <br/><i class="icon-refresh icon-spin"></i>',
						type: 'warning',
						timeout: 5000
					});
				});

				socket.on('api:user.get_online_users', function(users) {
					jQuery('a.username-field').each(function() {
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
					jQuery('button .username-field').each(function() {
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

				app.enter_room('global');


			},
			async: false
		});
	}

	// takes a string like 1000 and returns 1,000
	app.addCommas = function(text) {
		return text.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
	}

	// Willingly stolen from: http://phpjs.org/functions/strip_tags/
	app.strip_tags = function(input, allowed) {
		allowed = (((allowed || "") + "").toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join(''); // making sure the allowed arg is a string containing only tags in lowercase (<a><b><c>)
		var tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
			commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;

		return input.replace(commentsAndPhpTags, '').replace(tags, function($0, $1) {
			return allowed.indexOf('<' + $1.toLowerCase() + '>') > -1 ? $0 : '';
		});
	}

	// use unique alert_id to have multiple alerts visible at a time, use the same alert_id to fade out the current instance
	// type : error, success, info, warning/notify
	// title = bolded title text
	// message = alert message content
	// timeout default = permanent
	// location : alert_window (default) or content
	app.alert = function(params) {
		var alert_id = 'alert_button_' + ((params.alert_id) ? params.alert_id : new Date().getTime());

		var alert = $('#' + alert_id);

		function startTimeout(div, timeout) {
			var timeoutId = setTimeout(function() {
				$(div).fadeOut(1000, function() {
					$(this).remove();
				});
			}, timeout);

			$(div).attr('timeoutId', timeoutId);
		}

		if (alert.length > 0) {
			alert.find('strong').html(params.title);
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
			strong.innerHTML = params.title;

			div.className = "alert toaster-alert " + "alert-" + params.type;

			div.setAttribute('id', alert_id);
			div.appendChild(button);
			div.appendChild(strong);
			div.appendChild(p);

			button.className = 'close';
			button.innerHTML = '&times;';
			button.onclick = function(ev) {
				div.parentNode.removeChild(div);
			}

			if (params.location == null)
				params.location = 'alert_window';

			jQuery('#' + params.location).prepend(jQuery(div).fadeIn('100'));

			if (params.timeout) {
				startTimeout(div, params.timeout);
			}

			if (params.clickfn) {
				div.onclick = function() {
					params.clickfn();
					jQuery(div).fadeOut(500, function() {
						this.remove();
					});
				}
			}
		}
	}

	app.alertSuccess = function(message, timeout) {
		if (!timeout)
			timeout = 2000;

		app.alert({
			title: 'Success',
			message: message,
			type: 'success',
			timeout: timeout
		});
	}

	app.alertError = function(message, timeout) {
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
	app.enter_room = function(room) {
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

	app.populate_online_users = function() {
		var uids = [];

		jQuery('.post-row').each(function() {
			uids.push(this.getAttribute('data-uid'));
		});

		socket.emit('api:user.get_online_users', uids);
	}

	app.process_page = function() {

		// here is where all modules' onNavigate should be called, I think.
		require(['mobileMenu'], function(mobileMenu) {
			mobileMenu.onNavigate();
		});

		app.populate_online_users();

		var url = window.location.href,
			parts = url.split('/'),
			active = parts[parts.length - 1];

		jQuery('#main-nav li').removeClass('active');
		if (active) {
			jQuery('#main-nav li a').each(function() {
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



		setTimeout(function() {
			window.scrollTo(0, 1); // rehide address bar on mobile after page load completes.
		}, 100);
	}

	app.showLoginMessage = function() {
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

	app.addCommasToNumbers = function() {
		$('.formatted-number').each(function(index, element) {
			$(element).html(app.addCommas($(element).html()));
		});
	}

	app.openChat = function(username, touid) {
		require(['chat'], function(chat) {
			var chatModal;
			if (!chat.modalExists(touid)) {
				chatModal = chat.createModal(username, touid);
			} else {
				chatModal = chat.getModal(touid);
			}
			chat.load(chatModal.attr('UUID'));
		});
	}

	app.createNewPosts = function(data) {
		data.posts[0].display_moderator_tools = 'none';
		var html = templates.prepare(templates['topic'].blocks['posts']).parse(data),
			uniqueid = new Date().getTime(),
			tempContainer = jQuery('<div id="' + uniqueid + '"></div>')
				.appendTo("#post-container")
				.hide()
				.append(html)
				.fadeIn('slow');

		for (var x = 0, numPosts = data.posts.length; x < numPosts; x++) {
			socket.emit('api:post.privileges', data.posts[x].pid);
		}

		tempContainer.replaceWith(tempContainer.contents());
		infiniteLoaderActive = false;

		app.populate_online_users();
		app.addCommasToNumbers();
		$('span.timeago').timeago();
	}

	app.infiniteLoaderActive = false;

	app.loadMorePosts = function(tid, callback) {
		if (app.infiniteLoaderActive)
			return;
		app.infiniteLoaderActive = true;

		if ($('#loading-indicator').attr('done') === '0')
			$('#loading-indicator').removeClass('hide');

		socket.emit('api:topic.loadMore', {
			tid: tid,
			after: document.querySelectorAll('#post-container li[data-pid]').length
		}, function(data) {
			app.infiniteLoaderActive = false;
			if (data.posts.length) {
				$('#loading-indicator').attr('done', '0');
				app.createNewPosts(data);
			} else {
				$('#loading-indicator').attr('done', '1');
			}
			$('#loading-indicator').addClass('hide');
			if (callback)
				callback(data.posts);
		});
	}

	app.scrollToTop = function() {
		$('body,html').animate({
			scrollTop: 0
		});
	};

	app.scrollToBottom = function() {
		$('body,html').animate({
			scrollTop: $('html').height() - 100
		});
	}

	app.scrollToPost = function(pid) {

		if (!pid)
			return;

		var container = $(document.body),
			scrollTo = $('#post_anchor_' + pid),
			tid = $('#post-container').attr('data-tid');

		function animateScroll() {
			$('body,html').animate({
				scrollTop: scrollTo.offset().top - container.offset().top + container.scrollTop() - $('#header-menu').height()
			});
		}

		if (!scrollTo.length && tid) {

			var intervalID = setInterval(function() {
				app.loadMorePosts(tid, function(posts) {
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

	jQuery('document').ready(function() {
		$('#search-form').on('submit', function() {
			var input = $(this).find('input');
			ajaxify.go("search/" + input.val(), null, "search");
			input.val('');
			return false;
		});



	});

	showWelcomeMessage = location.href.indexOf('loggedin') !== -1;

	loadConfig();

}());