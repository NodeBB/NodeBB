var socket,
	config,
	app = {},
	API_URL = null;

// todo: cleanup,etc
(function() {

	$.ajax({
		url: '/config.json?v=' + new Date().getTime(),
		success: function(data) {
			API_URL = data.api_url;

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
	// title = bolded title text
	// message = alert message content
	// timeout default = permanent
	// location : notification_window (default) or content
	app.alert = function(params) {
		var div = document.createElement('div'),
			button = document.createElement('button'),
			strong = document.createElement('strong'),
			p = document.createElement('p');

		var alert_id = 'alert_button_' + ((params.alert_id) ? params.alert_id : new Date().getTime()); 

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
				jQuery(div).fadeOut(1000, function() {
					this.remove();
				});
			}, params.timeout)
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

	var post_window = null,
		submit_post_btn = null,
		post_title = null,
		reply_title = null,
		post_content = null;


	app.open_post_window = function(post_mode, id, title) {
		submit_post_btn = submit_post_btn || document.getElementById('submit_post_btn');
		post_title = post_title || document.getElementById('post_title');
		reply_title = reply_title || document.getElementById('reply_title');
		post_content = post_content || document.getElementById('post_content');

		post_window = post_window || document.getElementById('post_window');

		jQuery(post_window).slideDown(250);
		$(document.body).addClass('composing');

		if (post_mode == 'topic') {
			post_title.style.display = "block";
			reply_title.style.display = "none";
			post_title.focus();
			submit_post_btn.onclick = function() {
				app.post_topic(id);
			}
		} else {
			if (post_mode == 'reply') {
				reply_title.innerHTML = 'You are replying to "' + title + '"';
			} else if (post_mode == 'quote') {
				reply_title.innerHTML = 'You are quoting "' + title + '"';
			}

			post_title.style.display = "none";
			reply_title.style.display = "block";
			post_content.focus();
			submit_post_btn.onclick = function() {
				app.post_reply(id)
			} 
		}

	};




	app.post_reply = function(topic_id) {
		var	content = document.getElementById('post_content').value;

		if (content.length < 5) {
			app.alert({
				title: 'Reply Failure',
				message: 'You need to write more dude.',
				type: 'error',
				timeout: 2000
			});	

			return;
		}

		socket.emit('api:posts.reply', {
			'topic_id' : topic_id,
			'content' : content 
		});
		jQuery(post_window).slideDown(250);

	};
	app.post_topic = function(category_id) {
		var title = document.getElementById('post_title').value,
			content = document.getElementById('post_content').value;

		if (title.length < 5 || content.length < 5) {
			app.alert({
				title: 'Topic Post Failure',
				message: 'You need to write more dude.',
				type: 'error',
				timeout: 2000
			});	

			return;
		}

		socket.emit('api:topics.post', {
			'title' : title,
			'content' : content,
			'category_id' : category_id
		});
		
		jQuery('#post_title, #post_content').val('');
		jQuery(post_window).slideToggle(250);
		$(document.body).addClass('composing');
	};


	app.current_room = null; 
	app.enter_room = function(room) {
		if (app.current_room === room) return;

		socket.emit('event:enter_room', {
			'enter': room,
			'leave': app.current_room
		});

		app.current_room = room;
	};

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

		// Posting
		jQuery('#post_window').slideToggle(0);
	})



}());
