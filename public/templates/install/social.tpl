
<h1>Social Media Logins</h1>

<form class="form-inline">
	<p>
		You may opt to allow users to register and login in via a social media account, if that
		social network supports doing so.
	</p>

	<h3>Facebook</h3>
	<p>
		<label>Application ID</label> <input type="text" class="input-medium" data-field="social:facebook:app_id" />
	</p>
	<p>
		<label>Application Secret</label> <input type="text" class="input-large" data-field="social:facebook:secret" />
	</p>

	<h3>Twitter</h3>
	<p>
		<label>Application Key</label> <input type="text" class="input-medium" data-field="social:twitter:key" />
	</p>
	<p>
		<label>Application Secret</label> <input type="text" class="input-large" data-field="social:twitter:secret" />
	</p>

	<h3>Google</h3>
	<p>
		<label>Application ID</label> <input type="text" class="input-xxlarge" data-field="social:google:id" />
	</p>
	<p>
		<label>Application Secret</label> <input type="text" class="input-large" data-field="social:google:secret" />
	</p>
</form>

<hr />
<div class="pull-right">
	<button data-path="privileges" class="btn btn-primary btn-lg">Next &ndash; <i class="icon-legal"></i> Privileges</button>
</div>
<div>
	<button data-path="mail" class="btn btn-primary btn-lg">Previous &ndash; <i class="icon-envelope"></i> Mail</button>
</div>

<script>
	(function() {
		nodebb_setup.prepare();
	})();
</script>