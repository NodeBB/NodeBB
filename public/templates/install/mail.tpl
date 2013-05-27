
<h1>Mailer Information</h1>

<form class="form-inline">
	<p>
		The mailer information is used when sending out registration confirmation emails to new users.
		It is also used to send password reset emails to users who have forgotten their password.
	</p>
	<p>
		The defaults here correspond to a local <code>sendmail</code> server, although any third-party
		mail server can be used.
	</p>
	<p>
		<label>Hostname</label> <input type="text" class="input-medium" data-field="mailer:host" value="127.0.0.1" placeholder="127.0.0.1" />
	</p>
	<p>
		<label>Port</label> <input type="number" class="input-mini" data-field="mailer:port" value="25" placeholder="25" />
	</p>
	<p>
		<label>From</label> <input type="text" class="input-large" data-field="mailer:from" placeholder="John Smith <jsmith@example.org>" />
	</p>
</form>

<hr />
<div class="pull-right">
	<button data-path="social" class="btn btn-primary btn-large">Next &ndash; <i class="icon-facebook"></i> Social</button>
</div>

<script>
	(function() {
		nodebb_setup.prepare();
	})();
</script>