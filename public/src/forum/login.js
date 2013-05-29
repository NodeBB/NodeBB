(function() {
	// Alternate Logins
	var altLoginEl = document.querySelector('.alt-logins');
	altLoginEl.addEventListener('click', function(e) {
		if (e.target.nodeName === 'LI') {
			document.location.href = e.target.getAttribute('data-url');
		}
	});	
}());
