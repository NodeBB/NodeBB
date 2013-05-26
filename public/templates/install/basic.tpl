
<h1>Step 2 &ndash; Basic Information</h1>

<form class="form-inline">
	<h3>Path Information</h3>
	<p>
		Please enter the web-accessible url that will be used to point to the NodeBB installation. If you are using a port number in the address,
		<strong>include it in the field below, not here</strong>. Do not include a trailing slash.<br />
		<input type="text" class="input-large" data-field="base_url" placeholder="http://www.example.org" />
	</p>

	<p>
		<label class="checkbox"><input type="checkbox" data-field="use_port" checked /> Use port</label>
	</p>
	<p>
		<label>Port</label> <input type="number" class="input-mini" data-field="port" value="4567" placeholder="4567" />
	</p>

	<p>
		Path to uploads folder (relative to the root of the NodeBB install)<br />
		<input type="text" class="input-large" data-field="upload_url" value="/public/uploads" placeholder="/public/uploads" />
	</p>
</form>

<h3>NodeBB Secret</h3>
<p>
	This "secret" is used to encode user sessions, so they are not stored in plaintext. Enter a bunch of random characters below:
</p>
<input type="text" class="input-xxlarge" data-field="secret" placeholder="n239he#dh9j9$jc4h%y4yuhnx9y(&#y9ryn9c3" />

<hr />
<div class="pull-right">
	<button data-path="mail" class="btn btn-primary btn-large">Next &ndash; <i class="icon-envelope"></i> Mail</button>
</div>
<div>
	<button data-path="redis" class="btn btn-primary btn-large">Previous &ndash; <i class="icon-hdd"></i> Redis</button>
</div>

<script>
	(function() {
		nodebb_setup.prepare();

		var	portToggle = document.querySelector('input[data-field="use_port"]'),
			portEl = document.querySelector('input[data-field="port"]');

		portToggle.addEventListener('change', function(e) {
			if (e.target.checked) portEl.disabled = false;
			else portEl.disabled = true;
		});
	})();
</script>