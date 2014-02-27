$(function() {

	var menuEl = $('.sidebar-nav'),
		liEls = menuEl.find('li'),
		parentEl,
		activate = function(li) {
			liEls.removeClass('active');
			li.addClass('active');
		};

	// also on ready, check the pathname, maybe it was a page refresh and no item was clicked
	liEls.each(function(i, li){
		li = $(li);
		if ((li.find('a').attr('href') || '').indexOf(location.pathname) >= 0) {
			activate(li);
		}
	});

	// On menu click, change "active" state
	menuEl.on('click', function(e) {
		parentEl = $(e.target).parent();
		if (parentEl.is('li')) {
			activate(parentEl);
		}
	});
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
