var socket,
	config,
	app = {};

(function() {

	$.ajax({
		url: 'config.json?v=' + new Date().getTime(),
		success: function(data) {
			config = data;
			socket = io.connect('http://' + config.socket.address + config.socket.port? ':' + config.socket.port : '');

			socket.on('event:connect', function(data) {
				
			});

			socket.on('event:alert', function(data) {
				app.alert(data);
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

		div.className = "alert " + ((params.type=='warning') ? '' : "alert-" + params.type);
		
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
				jQuery(div).fadeOut('1000');
			}, params.timeout)
		}
	}

}());
