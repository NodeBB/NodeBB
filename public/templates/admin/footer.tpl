
		</div>
	</div>
	<div id="footer" class="container" style="padding-top: 50px; display:none;">
		<footer class="footer">Copyright &copy; 2013 <a target="_blank" href="http://www.nodebb.com">NodeBB</a> by <a target="_blank" href="https://github.com/psychobunny">psychobunny</a>, <a href="https://github.com/julianlam" target="_blank">julianlam</a>, <a href="https://github.com/barisusakli" target="_blank">barisusakli</a> from <a target="_blank" href="http://www.designcreateplay.com">designcreateplay</a></footer>
	</div>

<script type="text/javascript">
(function() {
	jQuery('document').ready(function() {
		// On menu click, change "active" state
		var menuEl = document.querySelector('.sidebar-nav'),
			liEls = menuEl.querySelectorAll('li')
			parentEl = null;

		menuEl.addEventListener('click', function(e) {
			parentEl = e.target.parentNode;
			if (parentEl.nodeName === 'LI') {
				for(var x=0,numLis=liEls.length;x<numLis;x++) {
					if (liEls[x] !== parentEl) jQuery(liEls[x]).removeClass('active');
					else jQuery(parentEl).addClass('active');
				}
			}
		}, false);
	});
	
}())	
</script>

</body>
</html>