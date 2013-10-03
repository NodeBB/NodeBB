jQuery('document').ready(function() {
	// On menu click, change "active" state
	var menuEl = document.querySelector('.sidebar-nav'),
		liEls = menuEl.querySelectorAll('li')
		parentEl = null;

	menuEl.addEventListener('click', function(e) {
		parentEl = e.target.parentNode;
		if (parentEl.nodeName === 'LI') {
			for (var x = 0, numLis = liEls.length; x < numLis; x++) {
				if (liEls[x] !== parentEl) jQuery(liEls[x]).removeClass('active');
				else jQuery(parentEl).addClass('active');
			}
		}
	}, false);
});

socket.once('api:config.get', function(config) {
	require(['forum/admin/settings'], function(Settings) {
		Settings.config = config;
	});
});

socket.emit('api:config.get');

socket.on('api:config.set', function(data) {
	if (data.status === 'ok') {
		app.alert({
			alert_id: 'config_status',
			timeout: 2500,
			title: 'Changes Saved',
			message: 'Your changes to the NodeBB configuration have been saved.',
			type: 'success'
		});
	} else {
		app.alert({
			alert_id: 'config_status',
			timeout: 2500,
			title: 'Changes Not Saved',
			message: 'NodeBB encountered a problem saving your changes',
			type: 'danger'
		});
	}
});