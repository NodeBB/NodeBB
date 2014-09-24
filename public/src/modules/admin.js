define('admin', ['mousetrap'], function(Mousetrap) {
	var Admin= {};

	Admin.init = function() {
		if (app.isAdmin) {
			Mousetrap.bind('ctrl+shift+a r', function() {
				console.log('[admin] Reloading NodeBB...');
				socket.emit('admin.reload');
			});

			Mousetrap.bind('ctrl+shift+a R', function() {
				console.log('[admin] Restarting NodeBB...');
				socket.emit('admin.restart');
			});
		}
	};

	return Admin;
});