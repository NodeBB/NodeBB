<h1>Twitter Social Authentication</h1>
<hr />

<form>
	<div class="alert alert-warning">
		<p>
			Create a <strong>Twitter Application</strong> via the
			<a href="https://dev.twitter.com/">Twitter Developers Page</a> and then
			paste your application details here.
		</p>
		<br />
		<input type="text" data-field="social:twitter:key" title="Consumer Key" class="form-control input-lg" placeholder="Consumer Key"><br />
		<input type="text" data-field="social:twitter:secret" title="Consumer Secret" class="form-control input-md" placeholder="Consumer Secret">
	</div>
</form>

<button class="btn btn-lg btn-primary" id="save">Save</button>

<script>
	var	loadDelay = setInterval(function() {
		if (nodebb_admin) {
			nodebb_admin.prepare();
			clearInterval(loadDelay);
		}
	}, 500);
</script>
