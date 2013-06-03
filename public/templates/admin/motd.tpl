
<h1>MOTD</h1>

<div class="alert motd">
	<p>
		The <strong>Message of the Day</strong> (MOTD) is typically a message shown to users when they first log into a forum or chat room.
		In NodeBB, the MOTD is present at the top of the forum homepage, and can be customized much like a header.
	</p>
	<p>
		You can enter either full HTML or Markdown text.
	</p>
	<textarea placeholder="Welcome to NodeBB!" data-field="motd" rows="10"></textarea>
</div>

<button class="btn btn-large btn-primary" id="save">Save</button>

<script>
	nodebb_admin.prepare();
</script>