'use strict';

$(document).ready(function () {
	setupNProgress();
	setupTaskbar();
	setupEditedByIcon();
	setupMobileMenu();
	setupQuickReply();
	configureNavbarHiding();
	updatePanelOffset();

	$(window).on('resize', utils.debounce(configureNavbarHiding, 200));
	$(window).on('resize', updatePanelOffset);

	function updatePanelOffset() {
		const headerEl = document.getElementById('header-menu');

		if (!headerEl) {
			console.warn('[persona/updatePanelOffset] Could not find #header-menu, panel offset unchanged.');
			return;
		}

		const headerRect = headerEl.getBoundingClientRect();
		const headerStyle = window.getComputedStyle(headerEl);

		let offset =
			headerRect.y + headerRect.height +
			(parseInt(headerStyle.marginTop, 10) || 0) +
			(parseInt(headerStyle.marginBottom, 10) || 0);

		offset = Math.max(0, offset);
		document.documentElement.style.setProperty('--panel-offset', `${offset}px`);
		localStorage.setItem('panelOffset', offset);
	}

	var lastBSEnv = '';
	function configureNavbarHiding() {
		if (!$.fn.autoHidingNavbar) {
			return;
		}

		require(['hooks', 'storage'], (hooks, Storage) => {
			let preference = ['xs', 'sm'];

			try {
				preference = JSON.parse(Storage.getItem('persona:navbar:autohide')) || preference;
			} catch (e) {
				console.warn('[persona/settings] Unable to parse value for navbar autohiding');
			}
			var env = utils.findBootstrapEnvironment();
			// if env didn't change don't destroy and recreate
			if (env === lastBSEnv) {
				return;
			}
			lastBSEnv = env;
			var navbarEl = $('.navbar-fixed-top');
			navbarEl.autoHidingNavbar('destroy').removeData('plugin_autoHidingNavbar');
			navbarEl.css('top', '');

			hooks
				.on('filter:navigator.scroll', (data) => {
					navbarEl.autoHidingNavbar('setDisableAutohide', true);
					return data;
				})
				.on('action:navigator.scrolled', () => {
					navbarEl.autoHidingNavbar('setDisableAutohide', false);
				});

			hooks.fire('filter:persona.configureNavbarHiding', {
				resizeEnvs: preference,
			}).then(({ resizeEnvs }) => {
				if (resizeEnvs.includes(env)) {
					navbarEl.autoHidingNavbar({
						showOnBottom: false,
					});
				}

				function fixTopCss(topValue) {
					if (ajaxify.data.template.topic) {
						$('.topic .topic-header').css({ top: topValue });
					} else {
						var topicListHeader = $('.topic-list-header');
						if (topicListHeader.length) {
							topicListHeader.css({ top: topValue });
						}
					}
				}

				navbarEl.off('show.autoHidingNavbar')
					.on('show.autoHidingNavbar', function () {
						fixTopCss('');
					});

				navbarEl.off('hide.autoHidingNavbar')
					.on('hide.autoHidingNavbar', function () {
						fixTopCss('0px');
					});
			});
		});
	}

	function setupNProgress() {
		require(['nprogress'], function (NProgress) {
			if (typeof NProgress === 'undefined') {
				return;
			}

			$(window).on('action:ajaxify.start', function () {
				NProgress.set(0.7);
			});

			$(window).on('action:ajaxify.end', function (ev, data) {
				NProgress.done();
				setupHoverCards();

				if (data.url && data.url.match('user/')) {
					setupFavouriteButtonOnProfile();
				}
			});
		});
	}

	function setupTaskbar() {
		require(['hooks'], (hooks) => {
			hooks.on('filter:taskbar.push', (data) => {
				data.options.className = 'taskbar-' + data.module;
				if (data.module === 'composer') {
					data.options.icon = 'fa-commenting-o';
				} else if (data.module === 'chat') {
					if (data.element.length && !data.element.hasClass('active')) {
						increaseChatCount(data.element);
					}
				}
			});
			hooks.on('action:taskbar.pushed', (data) => {
				if (data.module === 'chat') {
					createChatIcon(data);
					var elData = data.element.data();
					if (elData && elData.options && !elData.options.isSelf) {
						increaseChatCount(data.element);
					}
				}
			});
		});

		socket.on('event:chats.markedAsRead', function (data) {
			$('#taskbar [data-roomid="' + data.roomId + '"]')
				.removeClass('new')
				.attr('data-content', 0);
		});

		function createChatIcon(data) {
			$.getJSON(config.relative_path + '/api/user/' + app.user.userslug + '/chats/' + data.options.roomId, function (chatObj) {
				var el = $('#taskbar [data-uuid="' + data.uuid + '"] a');
				el.parent('[data-uuid]').attr('data-roomId', data.options.roomId);

				if (chatObj.users.length === 1) {
					var user = chatObj.users[0];
					el.find('i').remove();

					if (user.picture) {
						el.css('background-image', 'url(' + user.picture + ')');
						el.css('background-size', 'cover');
					} else {
						el.css('background-color', user['icon:bgColor'])
							.text(user['icon:text'])
							.addClass('user-icon');
					}
				}
			});
		}

		function increaseChatCount(el) {
			var count = (parseInt($(el).attr('data-content'), 10) || 0) + 1;
			$(el).attr('data-content', count);
		}
	}

	function setupEditedByIcon() {
		function activateEditedTooltips() {
			$('[data-pid] [component="post/editor"]').each(function () {
				var el = $(this);
				var icon;

				if (!el.attr('data-editor')) {
					return;
				}

				icon = el.closest('[data-pid]').find('.edit-icon').first();
				icon.prop('title', el.text()).tooltip('fixTitle').removeClass('hidden');
			});
		}

		$(window).on('action:posts.edited', function (ev, data) {
			var parent = $('[data-pid="' + data.post.pid + '"]');
			var icon = parent.find('.edit-icon').filter(function (index, el) {
				return parseInt($(el).closest('[data-pid]').attr('data-pid'), 10) === parseInt(data.post.pid, 10);
			});
			var el = parent.find('[component="post/editor"]').first();
			icon.prop('title', el.text()).tooltip('fixTitle').removeClass('hidden');
		});

		$(window).on('action:topic.loaded', activateEditedTooltips);
		$(window).on('action:posts.loaded', activateEditedTooltips);
	}

	function setupMobileMenu() {
		if (!window.addEventListener) {
			return;
		}

		require(['pulling/build/pulling-drawer', 'storage', 'alerts', 'search'], function (Pulling, Storage, alerts, search) {
			if (!Pulling) {
				return;
			}

			// initialization

			var chatMenuVisible = app.user && parseInt(app.user.uid, 10);
			var swapped = !!Storage.getItem('persona:menus:legacy-layout');
			var margin = window.innerWidth;

			if (swapped) {
				$('#mobile-menu').removeClass('pull-left');
				$('#mobile-chats').addClass('pull-left');
			}

			if (document.documentElement.getAttribute('data-dir') === 'rtl') {
				swapped = !swapped;
			}

			var navSlideout = Pulling.create({
				panel: document.getElementById('panel'),
				menu: document.getElementById('menu'),
				width: 256,
				margin: margin,
				side: swapped ? 'right' : 'left',
			});
			$('#menu').removeClass('hidden');

			var chatsSlideout;
			if (chatMenuVisible) {
				chatsSlideout = Pulling.create({
					panel: document.getElementById('panel'),
					menu: document.getElementById('chats-menu'),
					width: 256,
					margin: margin,
					side: swapped ? 'left' : 'right',
				});
				$('#chats-menu').removeClass('hidden');
			}

			// all menus

			function closeOnClick() {
				navSlideout.close();
				if (chatsSlideout) { chatsSlideout.close(); }
			}

			function onBeforeOpen() {
				document.documentElement.classList.add('slideout-open');
			}

			function onClose() {
				$('#mobile-menu').blur();
				document.documentElement.classList.remove('slideout-open');
				$('#panel').off('click', closeOnClick);
			}

			$(window).on('resize action:ajaxify.start', function () {
				navSlideout.close();
				if (chatsSlideout) {
					chatsSlideout.close();
				}
			});

			navSlideout
				.ignore('code, code *, .preventSlideout, .preventSlideout *')
				.on('closed', onClose)
				.on('beforeopen', onBeforeOpen)
				.on('opened', function () {
					$('#panel').one('click', closeOnClick);
				});

			if (chatMenuVisible) {
				chatsSlideout
					.ignore('code, code *, .preventSlideout, .preventSlideout *')
					.on('closed', onClose)
					.on('beforeopen', onBeforeOpen)
					.on('opened', function () {
						$('#panel').one('click', closeOnClick);
					});
			}

			// left slideout navigation menu

			$('#mobile-menu').on('click', function () {
				navSlideout.enable().toggle();
			});

			if (chatMenuVisible) {
				navSlideout.on('beforeopen', function () {
					chatsSlideout.close();
					chatsSlideout.disable();
				}).on('closed', function () {
					chatsSlideout.enable();
				});
			}

			$('#menu [data-section="navigation"] ul').html(
				$('#main-nav').html() +
				($('#logged-out-menu').html() || '')
			);

			$('#user-control-list').children().clone(true, true).appendTo($('#chats-menu [data-section="profile"] ul'));

			socket.on('event:user_status_change', function (data) {
				if (parseInt(data.uid, 10) === app.user.uid) {
					app.updateUserStatus($('#chats-menu [component="user/status"]'), data.status);
					navSlideout.close();
				}
			});

			// right slideout notifications & chats menu

			function loadNotificationsAndChats() {
				require(['notifications', 'chat'], function (notifications, chat) {
					const notifList = $('#chats-menu [data-section="notifications"] ul');
					notifications.loadNotifications(notifList, function () {
						notifList.find('.deco-none').removeClass('deco-none');
						chat.loadChatsDropdown($('#chats-menu .chat-list'));
					});
				});
			}

			if (chatMenuVisible) {
				$('#mobile-chats').removeClass('hidden').on('click', function () {
					navSlideout.close();
					chatsSlideout.enable().toggle();
				});
				$('#chats-menu').on('click', 'li[data-roomid]', function () {
					chatsSlideout.close();
				});

				chatsSlideout
					.on('opened', loadNotificationsAndChats)
					.on('beforeopen', function () {
						navSlideout.close().disable();
					})
					.on('closed', function () {
						navSlideout.enable();
					});
			}

			const searchInputEl = $('.navbar-header .navbar-search input[name="term"]');
			const searchButton = $('.navbar-header .navbar-search button[type="button"]');
			searchButton.off('click').on('click', function () {
				if (!config.loggedIn && !app.user.privileges['search:content']) {
					alerts.alert({
						message: '[[error:search-requires-login]]',
						timeout: 3000,
					});
					ajaxify.go('login');
					return false;
				}

				searchButton.addClass('hidden');
				searchInputEl.removeClass('hidden').focus();
				return false;
			});
			searchInputEl.on('blur', function () {
				searchInputEl.addClass('hidden');
				searchButton.removeClass('hidden');
			});
			search.enableQuickSearch({
				searchElements: {
					inputEl: searchInputEl,
					resultEl: $('.navbar-header .navbar-search .quick-search-container'),
				},
				searchOptions: {
					in: config.searchDefaultInQuick,
				},
			});
		});
	}

	function setupHoverCards() {
		require(['components'], function (components) {
			components.get('topic')
				.on('click', '[component="user/picture"],[component="user/status"]', generateUserCard);
		});

		$(window).on('action:posts.loading', function (ev, data) {
			for (var i = 0, ii = data.posts.length; i < ii; i++) {
				(ajaxify.data.topics || ajaxify.data.posts)[data.posts[i].index] = data.posts[i];
			}
		});
	}

	function generateUserCard(ev) {
		var avatar = $(this);
		var uid = avatar.parents('[data-uid]').attr('data-uid');
		var data = (ajaxify.data.topics || ajaxify.data.posts);

		for (var i = 0, ii = data.length; i < ii; i++) {
			if (parseInt(data[i].uid, 10) === parseInt(uid, 10)) {
				data = data[i].user;
				break;
			}
		}

		$('.persona-usercard').remove();

		if (parseInt(data.uid, 10) === 0) {
			return false;
		}

		socket.emit('user.isFollowing', { uid: data.uid }, function (err, isFollowing) {
			if (err) {
				return err;
			}

			app.parseAndTranslate('modules/usercard', data, function (html) {
				var card = $(html);
				avatar.parents('a').after(card.hide());

				if (parseInt(app.user.uid, 10) === parseInt(data.uid, 10) || !app.user.uid) {
					card.find('.btn-morph').hide();
				} else {
					setupFavouriteMorph(card, data.uid, data.username);

					if (isFollowing) {
						$('.btn-morph').addClass('heart');
					} else {
						$('.btn-morph').addClass('plus');
					}
				}

				utils.makeNumbersHumanReadable(card.find('.human-readable-number'));
				setupCardRemoval(card);
				card.fadeIn();
			});
		});

		ev.preventDefault();
		return false;
	}

	function setupFavouriteButtonOnProfile() {
		setupFavouriteMorph($('[component="account/cover"]'), ajaxify.data.uid, ajaxify.data.username);
	}

	function setupCardRemoval(card) {
		function removeCard(ev) {
			if ($(ev.target).closest('.persona-usercard').length === 0) {
				card.fadeOut(function () {
					card.remove();
				});

				$(document).off('click', removeCard);
			}
		}

		$(document).on('click', removeCard);
	}

	function setupFavouriteMorph(parent, uid, username) {
		require(['api', 'alerts'], function (api, alerts) {
			parent.find('.btn-morph').click(function (ev) {
				var type = $(this).hasClass('plus') ? 'follow' : 'unfollow';
				var method = $(this).hasClass('plus') ? 'put' : 'del';

				api[method]('/users/' + uid + '/follow').then(() => {
					alerts.success('[[global:alert.' + type + ', ' + username + ']]');
				});

				$(this).toggleClass('plus').toggleClass('heart');
				$(this).translateAttr('title', type === 'follow' ? '[[global:unfollow]]' : '[[global:follow]]');

				if ($(this).find('b.drop').length === 0) {
					$(this).prepend('<b class="drop"></b>');
				}

				var drop = $(this).find('b.drop').removeClass('animate');
				var x = ev.pageX - (drop.width() / 2) - $(this).offset().left;
				var y = ev.pageY - (drop.height() / 2) - $(this).offset().top;

				drop.css({ top: y + 'px', left: x + 'px' }).addClass('animate');
			});
		});
	}

	function setupQuickReply() {
		$(window).on('action:ajaxify.end', function (ev, data) {
			if (data.url && data.url.match('^topic/')) {
				if (config.enableQuickReply) {
					require(['persona/quickreply'], function (quickreply) {
						if (quickreply) {
							quickreply.init();
						}
					});
				}

				$('.topic-main-buttons [title]').tooltip();
			}
		});
	}
});
