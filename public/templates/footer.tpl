

	</div><!--END container -->

	<div id="disconnect-modal" class="modal hide" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
		<div class="modal-header">
			<h3 id="myModalLabel">Socket Disconnect</h3>
		</div>
		<div class="modal-body">
			<span id="disconnect-text">Looks like you disconnected, try reloading the page.</span>
		</div>
		<div class="modal-footer">
			<a id="reload-button" href="/" class="btn btn-primary">Reload</a>
		</div>
	</div>

	<div id="chat-modal" class="modal hide" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
		<div class="modal-header">
			<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
			<h3 id="myModalLabel">Chat with <span id="chat-with-name"></span></h3>
		</div>
		<div class="modal-body">
			<textarea id="chat-content" cols="40" rows="10" readonly></textarea><br/>
			<input id="chat-message-input" type="text" name="chat-message" placeholder="type chat message here press enter to send"/><br/>
			<button type="button" id="chat-message-send-btn" href="#" class="btn btn-primary">Send</button>
		</div>
	</div>

	<div id="alert_window"></div>

	<div id="mobile-sidebar">
	</div>

	<!-- START Forum Info -->
	<div id="footer" class="container hidden-phone" style="padding-top: 50px; display: none">
		<div class="alert alert-info">
			<span id="active_users"></span>; <span id="active_record"></span><br />
			<span id="number_of_users"></span> <span id="post_stats"></span><br />
			<span id="latest_user"></span>
		</div>
		<footer class="footer">Copyright &copy; 2013 <a target="_blank" href="http://www.nodebb.org">NodeBB</a> by <a target="_blank" href="https://github.com/psychobunny">psychobunny</a>, <a href="https://github.com/julianlam" target="_blank">julianlam</a>, <a href="https://github.com/barisusakli" target="_blank">barisusakli</a> from <a target="_blank" href="http://www.designcreateplay.com">designcreateplay</a></footer>
	</div>

	<div id="mobile-menu">
		<button id="mobile-menu-btn" type="button" class="btn btn-none"><i class="icon-th icon-2x"></i></button>
		<button id="mobile-post-btn" type="button" class="btn btn-none"><i class="icon-plus icon-2x"></i></button>
	</div>
	
	<!-- END Forum Info -->
	<script>
		$.getScript(RELATIVE_PATH + '/src/forum/footer.js');
	</script>
	
</body>
</html>