var socket,
	config,
	app = {};

// todo: cleanup,etc
(function() {

	$.ajax({
		url: '/config.json?v=' + new Date().getTime(),
		success: function(data) {
			config = data;
			socket = io.connect('http://' + config.socket.address + config.socket.port? ':' + config.socket.port : '');

			socket.on('event:connect', function(data) {
				console.log('connected to nodebb socket: ', data);
			});

			socket.on('event:alert', function(data) {
				app.alert(data);
			});
			
			socket.on('event:consolelog', function(data) {
				console.log(data);
			});
		},
		async: false


	});

	// use unique alert_id to have multiple alerts visible at a time, use the same alert_id to fade out the current instance  
	// type : error, success, info, warning/notify
	// timeout default = permanent
	// location : notification_window (default) or content
	app.alert = function(params) {
		var div = document.createElement('div'),
			button = document.createElement('button'),
			strong = document.createElement('strong'),
			p = document.createElement('p');

		var alert_id = 'alert_button_' + ((alert_id) ? alert_id : new Date().getTime()); 

		jQuery('#'+alert_id).fadeOut(500, function() {
			this.remove();
		});

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

		if (params.location == null) params.location = 'notification_window';

		jQuery('#'+params.location).prepend(jQuery(div).fadeIn('100'));

		if (params.timeout) {
			setTimeout(function() {
				jQuery(div).fadeOut(1000);
			}, params.timeout)
		}

		if (params.clickfn) {
			div.onclick = function() {
				params.clickfn();
				jQuery(div).fadeOut(500);
			}
		}
	}

	var post_window = null;
	app.open_post_window = function() {
		post_window = post_window || document.getElementById('post_window');
		jQuery(post_window).slideToggle(250);
		document.getElementById('post_title').focus();

	};

	app.post_topic = function() {
		var title = document.getElementById('post_title').value,
			content = document.getElementById('post_content').value;

		if (title.length < 5 || content.length < 5) {
			app.alert({
				title: 'Topic Post Failure',
				message: 'You need to write more dude.',
				type: 'error',
				timeout: 2000,
				clickfn: function() {
					ajaxify.go('register');
				}
			});	

			return;
		}

		socket.emit('api:topics.post', {
			'title' : title,
			'content' : content 
		});
		jQuery(post_window).slideToggle(250);
	};

	jQuery('document').ready(function() {
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

		// Posting
		jQuery('#post_window').slideToggle(0);
	})



}());
