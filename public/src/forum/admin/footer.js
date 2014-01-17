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

socket.emit('admin.config.get', function(err, config) {
	if(err) {
		return app.alert({
			alert_id: 'config_status',
			timeout: 2500,
			title: 'Error',
			message: 'NodeBB encountered a problem getting config',
			type: 'danger'
		});
	}
	app.config = config;
});
