var socket,
	config,
	app = {},
	API_URL = null,
	RELATIVE_PATH = null;

// todo: cleanup,etc
(function() {

	$.ajax({
		url: '/forum/config.json?v=' + new Date().getTime(),
		success: function(data) {
			API_URL = data.api_url;
			RELATIVE_PATH = data.relative_path;

			config = data;
			socket = io.connect(config.socket.address + (config.socket.port ? ':' + config.socket.port : ''));

			var reconnecting = false;
			var reconnectTries = 0;


			socket.on('event:connect', function(data) {
				console.log('connected to nodebb socket: ', data);
			});

			socket.on('event:alert', function(data) {
				app.alert(data);
			});
			
			socket.on('event:consolelog', function(data) {
				console.log(data);
			});

			socket.on('connect', function(data){
				if(reconnecting) {
					setTimeout(function(){
						app.alert({
							alert_id: 'connection_alert',
							title: 'Connected',
							message: 'Connection successful.',
							type: 'success',
							timeout: 5000
						});
					}, 1000);
					reconnecting = false;
					socket.emit('api:updateHeader', { fields: ['username', 'picture', 'userslug'] });
				}
			});

			socket.on('disconnect', function(data){
				
			});

			socket.on('reconnecting', function(data) {
				reconnecting = true;
				reconnectTries++;
				if(reconnectTries > 4) {
					showDisconnectModal();
					return;
				}
				app.alert({
					alert_id: 'connection_alert',
					title: 'Reconnecting',
					message: 'You have disconnected from NodeBB, we will try to reconnect you. <br/><i class="icon-refresh icon-spin"></i>',
					type: 'notify',
					timeout: 5000
				});
			});

			function showDisconnectModal() {
				$('#disconnect-modal').modal({
					backdrop:'static',
					show:true
				});

				$('#reload-button').on('click',function(){
					$('#disconnect-modal').modal('hide');
					window.location.reload();
				});
			}
		},
		async: false
	});

	// takes a string like 1000 and returns 1,000
	app.addCommas = function(text) {
		return text.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
	}

	// Willingly stolen from: http://phpjs.org/functions/strip_tags/
	app.strip_tags = function(input, allowed) {
		allowed = (((allowed || "") + "").toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join(''); // making sure the allowed arg is a string containing only tags in lowercase (<a><b><c>)
		var	tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
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
	app.alert = function(params) {
		var alert_id = 'alert_button_' + ((params.alert_id) ? params.alert_id : new Date().getTime()); 

		var alert = $('#'+alert_id);

		function startTimeout(div, timeout) {
			var timeoutId = setTimeout(function() {
				$(div).fadeOut(1000, function() {
					$(this).remove();
				});
			}, timeout);
			
			$(div).attr('timeoutId', timeoutId);
		}

		if(alert.length > 0) {
			alert.find('strong').html(params.title);
			alert.find('p').html(params.message);
			alert.attr('class', "alert toaster-alert " + ((params.type=='warning') ? '' : "alert-" + params.type));
			
			clearTimeout(alert.attr('timeoutId'));
			startTimeout(alert, params.timeout);
		}
		else {
			var div = document.createElement('div'),
				button = document.createElement('button'),
				strong = document.createElement('strong'),
				p = document.createElement('p');

			p.innerHTML = params.message;
			strong.innerHTML = params.title;

			div.className = "alert toaster-alert " + ((params.type=='warning') ? '' : "alert-" + params.type);
			
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

			jQuery('#'+params.location).prepend(jQuery(div).fadeIn('100'));

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

	

	app.current_room = null; 
	app.enter_room = function(room) {
		if (app.current_room === room) return;

		socket.emit('event:enter_room', {
			'enter': room,
			'leave': app.current_room
		});

		app.current_room = room;
	};

	app.process_page = function() {

		function populate_online_users() {
			var uids = [];

			jQuery('.post-row').each(function() {
				uids.push(this.getAttribute('data-uid'));
			});
			
			socket.emit('api:user.get_online_users', uids);
		}

		// here is where all modules' onNavigate should be called, I think.
		require(['mobileMenu'], function(mobileMenu) {
			mobileMenu.onNavigate();
		});


		populate_online_users();

		setTimeout(function() {
			window.scrollTo(0, 1); // rehide address bar on mobile after page load completes.	
		}, 100);
	}

	socket.on('api:user.get_online_users', function(users) {
		jQuery('.username-field').each(function() {
			if (this.processed === true) return;

			var el = jQuery(this),
				uid = el.parents('li').attr('data-uid');
			
			if (uid && jQuery.inArray(uid, users) !== -1) {
				el.prepend('<i class="icon-circle"></i>&nbsp;');
			} else {
				el.prepend('<i class="icon-circle-blank"></i>&nbsp;');
			}

			el.processed = true;
		});
	});

	jQuery('document').ready(function() {
		app.enter_room('global');


		// On menu click, change "active" state
		var menuEl = document.querySelector('.nav'),
			liEls = menuEl.querySelectorAll('li'),
			logoutEl = document.getElementById('logout'),
			parentEl;

		menuEl.addEventListener('click', function(e) {
			parentEl = e.target.parentNode;
			if (parentEl.nodeName === 'LI') {
				for(var x=0,numLis=liEls.length;x<numLis;x++) {
					if (liEls[x] !== parentEl) liEls[x].className = '';
					else parentEl.className = 'active';
				}
			}
		}, false);

		
		addTouchEvents();
	});



	
	function addTouchEvents() {
		return; // later.


		// click simulation just for testing/sanity purposes.

		var el = jQuery("#content"),
			sidebar = jQuery('#mobile-sidebar'),
			width = el.width();

		function onTouchMove(ev) {
			var coordinates = window.event ? window.event.touches[0] : ev.touches[0];

			el.css({
				marginLeft: -parseInt(width - coordinates.pageX) + 'px',
				paddingRight: parseInt(width - coordinates.pageX) + 'px'});

			sidebar.css({
				marginLeft: -parseInt(width - coordinates.pageX) + 'px',
				width: parseInt(width - coordinates.pageX) + 'px'
			});
		}

		function onMouseMove(ev) {
			ev.touches = [{pageX: ev.pageX, pageY: ev.pageY}];
			onTouchMove(ev);
		}

		function onTouchEnd() {
			el.css({
				marginLeft: '0px',
				paddingRight: '0px'
			});

			sidebar.css({
				marginLeft: '0px',
				width: '0px'
			});
		}

		el.on('touchmove', onTouchMove);
		el.on('mousedown', function() {
			el.on('mousemove', onMouseMove);
		});

		el.on('touchend', onTouchEnd);
		el.on('mouseup', function() {
			el.off('mousemove');
			onTouchEnd();
		});
		
	}
}());
