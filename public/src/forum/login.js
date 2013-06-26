(function() {
	// Alternate Logins
	var altLoginEl = document.querySelector('.alt-logins');
	altLoginEl.addEventListener('click', function(e) {
		var target;
		switch(e.target.nodeName) {
			case 'LI': target = e.target; break;
			case 'I': target = e.target.parentNode; break;
		}
		if (target) {
			document.location.href = target.getAttribute('data-url');
		}
	});	
	
	
	$('#login').on('click', function() {
		
		var loginData = {
			'username': $('#username').val(),
			'password': $('#password').val(),
			'_csrf': $('#csrf-token').val()
		};
				
		$.ajax({
			type: "POST",
			url: '/login',
			data: loginData,
			success: function(data, textStatus, jqXHR) {
				$('#login-error-notify').hide();
				window.location.replace("/");
			},
			error : function(data, textStatus, jqXHR) {
				$('#login-error-notify').show().delay(1000).fadeOut(250);
			},
			dataType: 'json'
		});
		
		return false;
	});
	
}());
