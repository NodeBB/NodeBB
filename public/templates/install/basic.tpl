
<h1>Step 1 &ndash; Basic Information</h1>

<p class="lead">
	Thanks for choosing to install NodeBB! We&apos;ll need some information to set up your installation
	configuration...
</p>

<h3>Path Information</h3>
<p>
	Please enter the web-accessible url that will be used to point to the NodeBB installation. If you are using a port number in the address,
	<strong>include it in the field below, not here</strong>
	<input type="text" class="input-large" data-field="base_url" placeholder="http://www.example.org" />
</p>

<p>
	<label class="checkbox"><input type="checkbox" data-field="use_port" /> Use port</label>
</p>

<form class="form-inline">
	<label>Port</label> <input type="text" data-field="port" />
</form>

<h3>NodeBB Secret</h3>
<p>
	This "secret" is used to encode user sessions, so they are not stored in plaintext. Enter a bunch of random characters below:
</p>
<input type="text" class="input-xxlarge" data-field="secret" placeholder="n239he#dh9j9$jc4h%y4yuhnx9y(&#y9ryn9c3" />