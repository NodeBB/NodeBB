
(function() {
	jQuery('document').ready(function() {

		var yourid = templates.get('yourid');

		var url = window.location.href,
			parts = url.split('/'),
			active = parts[parts.length-1];

		jQuery('.nav-pills li').removeClass('active');
		jQuery('.nav-pills li a').each(function() {
			if (this.getAttribute('href').match(active)) {
				jQuery(this.parentNode).addClass('active');
				return false;
			}
		});

		jQuery('#search-user').on('keyup', function () {
			console.log('derp'); 
			jQuery('.icon-spinner').removeClass('none');
			console.log($('#search-user').val());
			socket.emit('api:admin.user.search', $('#search-user').val());
		});



		

		function isUserAdmin(element) {
			var parent = $(element).parents('.users-box');
			return (parent.attr('data-admin') !== "0");
		}

		function getUID(element) {
			var parent = $(element).parents('.users-box');
			return parent.attr('data-uid');	
		}

		jQuery('.admin-btn').each(function(index, element) {
			var adminBtn = $(element);
			var isAdmin = isUserAdmin(adminBtn);
			
			if(isAdmin)
				adminBtn.addClass('btn-success');
			else
				adminBtn.removeClass('btn-success');

		});

		jQuery('.delete-btn').each(function(index, element) {
			var deleteBtn = $(element);
			var isAdmin = isUserAdmin(deleteBtn);
			
			if(isAdmin)
				deleteBtn.addClass('disabled');
			else
				deleteBtn.show();
		});

		jQuery('.admin-btn').on('click', function() {
			var adminBtn = $(this);
			var isAdmin = isUserAdmin(adminBtn);
			var parent = adminBtn.parents('.users-box');
			var uid = getUID(adminBtn);

			if(isAdmin) {
				socket.emit('api:admin.user.removeAdmin', uid);		
				adminBtn.removeClass('btn-success');
				parent.find('.delete-btn').removeClass('disabled');
				parent.attr('data-admin', 0);
			}
			else {
				bootbox.confirm('Do you really want to make "' + parent.attr('data-username') +'" an admin?', function(confirm) {
					if(confirm) {
						socket.emit('api:admin.user.makeAdmin', uid);
						adminBtn.addClass('btn-success');
						parent.find('.delete-btn').addClass('disabled');
						parent.attr('data-admin', 1);
					}
				});
			}
			
			return false;
		});

		jQuery('.delete-btn').on('click', function() {
			var deleteBtn = $(this);
			var isAdmin = isUserAdmin(deleteBtn);
			var parent = deleteBtn.parents('.users-box');
			var uid = getUID(deleteBtn);

			if(!isAdmin) {
				bootbox.confirm('Do you really want to delete "' + parent.attr('data-username') +'"?', function(confirm) {
					socket.emit('api:admin.user.deleteUser', uid);		
				});
			}
			
			return false;
		});
	
	});
	
}());