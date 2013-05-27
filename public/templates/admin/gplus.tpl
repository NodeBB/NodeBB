<h1>Google Accounts Social Authentication</h1>
<hr />

<form>
	<div class="alert alert-notify">
		<p>
			Create a <strong>Google Application</strong> via the
			<a href="https://code.google.com/apis/console/">API Console</a> and then paste
			your application details here.
		</p>
		<br />
		<input type="text" data-field="social:google:id" title="Client ID" class="input-xxlarge" placeholder="Client ID"><br />
		<input type="text" data-field="social:google:secret" title="Client Secret" class="input-large" placeholder="Client Secret"><br />
	</div>
</form>

<button class="btn btn-large btn-primary" id="save">Save</button>

<script>
	nodebb_admin.prepare();
</script>