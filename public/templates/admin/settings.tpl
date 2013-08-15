<h1>Settings</h1>
<hr />

<h3>General Settings</h3>
<div class="alert">
	<form>
		<label>Site Title</label>
		<input type="text" placeholder="Your Community Name" data-field="title" />
		<label>Site Description</label>
		<input type="text" class="input-xxlarge" placeholder="A short description about your community" data-field="description" />
		<label>Imgur Client ID</label>
		<input type="text" class="input-xxlarge" placeholder="Imgur ClientID for image uploads" data-field="imgurClientID" />
	</form>
</div>

<form>
	<h3>Privilege Thresholds</h3>
	<div class="alert alert-notify">
		<p>Use <strong>privilege thresholds</strong> to manage how much reputation a user must gain to receive moderator access.</p><br />
		<strong>Manage Thread</strong><br /> <input type="text" class="" value="1000"><br />
		<strong>Moderate Users</strong><br /> <input type="text" class="" value="10000"><br />
		<strong>Create Pinned Topics</strong><br /> <input type="text" class="" value="100000"><br />
		
	</div>
</form>

<form>
	<h3>Email Settings</h3>
	<div class="alert alert-notify">
		<div>
			<p>
				<strong>Email Address</strong><br />
				The following email address refers to the email that the recipient will see in the "From" and "Reply To" fields.
			</p>
			<input type="text" class="input-large" data-field="email:from" placeholder="info@example.org" />
		</div>
		<div>
			<p>
				<strong>SMTP Server Host</strong><br />
				(Default: <em>127.0.0.1</em>)
			</p>
			<input type="text" class="input-medium" data-field="email:smtp:host" placeholder="127.0.0.1" />
		</div>
		<div>
			<p>
				<strong>SMTP Server Port</strong>
			</p>
			<input type="text" class="input-mini" data-field="email:smtp:port" placeholder="25" />
		</div>
	</div>
</form>

<form>
	<h3>Post Settings</h3>
	<div class="alert alert-notify">
		<strong>Post Delay</strong><br /> <input type="text" class="" value="10000" data-field="postDelay"><br />
		<strong>Minimum Title Length</strong><br /> <input type="text" class="" value="3" data-field="minimumTitleLength"><br />
		<strong>Minimum Post Length</strong><br /> <input type="text" class="" value="8" data-field="minimumPostLength"><br />
		
	</div>
</form>

<button class="btn btn-large btn-primary" id="save">Save</button>

<script>
	nodebb_admin.prepare();
</script>