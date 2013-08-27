

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


	<div id="chat-modal" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
					<h3 id="myModalLabel">Chat with <span id="chat-with-name"></span></h3>
				</div>
				<div class="modal-body">
					<textarea class="form-control" id="chat-content" cols="40" rows="10" readonly></textarea><br/>
					<input id="chat-message-input" type="text" class="form-control" name="chat-message" placeholder="type chat message, here press enter to send"/>
				</div>
				<div class="modal-footer">
					<button type="button" id="chat-message-send-btn" href="#" class="btn btn-primary btn-lg btn-block
					">Send</button>
				</div>
			</div><!-- /.modal-content -->
		</div><!-- /.modal-dialog -->
	</div><!-- /.modal -->


	<div id="alert_window"></div>

	<!-- START Forum Info -->
	<div id="footer" class="container" style="padding-top: 50px; display: none">
		<div class="alert alert-info">
			<span id="active_users"></span>; <span id="active_record"></span><br />
			<span id="number_of_users"></span> <span id="post_stats"></span><br />
			<span id="latest_user"></span>
		</div>
		<footer class="footer">Copyright &copy; 2013 <a target="_blank" href="http://www.nodebb.org">NodeBB</a> by <a target="_blank" href="https://github.com/psychobunny">psychobunny</a>, <a href="https://github.com/julianlam" target="_blank">julianlam</a>, <a href="https://github.com/barisusakli" target="_blank">barisusakli</a> from <a target="_blank" href="http://www.designcreateplay.com">designcreateplay</a></footer>
	</div>

	<!-- END Forum Info -->
	<script>
		$.getScript(RELATIVE_PATH + '/src/forum/footer.js');
	</script>

</body>
</html>