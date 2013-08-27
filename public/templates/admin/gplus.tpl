<h1>Google Accounts Social Authentication</h1>
<hr />

<form>
	<div class="alert alert-warning">
		<p>
			Create a <strong>Google Application</strong> via the
			<a href="https://code.google.com/apis/console/">API Console</a> and then paste
			your application details here.
		</p>
		<br />
		<input type="text" data-field="social:google:id" title="Client ID" class="form-control input-lg" placeholder="Client ID"><br />
		<input type="text" data-field="social:google:secret" title="Client Secret" class="form-control" placeholder="Client Secret"><br />
	</div>
</form>

<button class="btn btn-lg btn-primary" id="save">Save</button>

<script>
	nodebb_admin.prepare();
</script>