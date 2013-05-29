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
}());
