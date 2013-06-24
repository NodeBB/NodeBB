<h1>Facebook Social Authentication</h1>
<hr />

<form>
	<div class="alert alert-notify">
		<p>
			Create a <strong>Facebook Application</strong> via the
			<a href="https://developers.facebook.com/">Facebook Developers Page</a> and
			then paste your application details here.
		</p>
		<br />
		<input type="text" data-field="social:facebook:app_id" title="Application ID" class="input-medium" placeholder="App ID"><br />
		<input type="text" data-field="social:facebook:secret" title="Application Secret" class="input-large" placeholder="App Secret"><br />
	</div>
</form>

<button class="btn btn-large btn-primary" id="save">Save</button>

<script>
	nodebb_admin.prepare();
</script>