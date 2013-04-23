
	</div><!--END container -->
	<script>
		(function() {
			// On menu click, change "active" state
			var menuEl = document.querySelector('.nav'),
				liEls = menuEl.querySelectorAll('li'),
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
		})();
	</script>
</body>
</html>