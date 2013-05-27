<h1>Twitter Social Authentication</h1>
<hr />

<form>
	<div class="alert alert-notify">
		<p>
			Create a <strong>Twitter Application</strong> via the
			<a href="https://dev.twitter.com/">Twitter Developers Page</a> and then
			paste your application details here.
		</p>
		<br />
		<input type="text" data-field="social:twitter:key" title="Consumer Key" class="input-large" placeholder="Consumer Key"><br />
		<input type="text" data-field="social:twitter:secret" title="Consumer Secret" class="input-xlarge" placeholder="Consumer Secret">
	</div>
</form>

<button class="btn btn-large btn-primary" id="save">Save</button>

<script>
	nodebb_admin.prepare();
</script>
