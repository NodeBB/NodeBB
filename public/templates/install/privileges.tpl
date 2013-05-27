
<h1>User Privilege Thresholds</h1>

<form class="form-inline">
	<p>
		Privilege thresholds grants a community membership the ability to moderate itself.
		These numbers denote the minimum amount of user reputation required before the
		corresponding privilege is unlocked.
	</p>
	<p>
		Reputation is gained when other users favourite posts that you have made.
	</p>

	<p>
		<label>Manage Content</label> <input type="number" class="input-mini" value="1000" placeholder="1000" data-field="privileges:manage_content" />
	</p>
	<p>
		Users with reach the "Manage Content" threshold are able to edit/delete other users' posts.
	</p>
	<p>
		<label>Manage Topics</label> <input type="number" class="input-mini" value="2000" placeholder="2000" data-field="privileges:manage_topic" />
	</p>
	<p>
		Users with reach the "Manage Topics" threshold are able to edit, lock, pin, close, and delete topics.
	</p>
</form>

<hr />
<div class="pull-right">
	<button id="start-nodebb" class="btn btn-success btn-large"><i class="icon-thumbs-up"></i> Start using NodeBB!</button>
</div>
<div>
	<button data-path="social" class="btn btn-primary btn-large">Previous &ndash; <i class="icon-facebook"></i> Social</button>
</div>

<script>
	(function() {
		nodebb_setup.prepare();

		var startEl = document.getElementById('start-nodebb');
		startEl.addEventListener('click', function(e) {
			e.preventDefault();
			document.location.href = '/';
		});
	})();
</script>