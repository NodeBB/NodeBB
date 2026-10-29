<p>{{tx("admin/settings/activitypub:blocklists.add-help")}}</p>

<hr />

<form role="form">
	<div class="mb-3">
		<label class="form-label" for="url">{{tx("admin/settings/activitypub:blocklists.add-url")}}</label>
		<input type="url" id="url" name="url" title="Blocklist URL" class="form-control" placeholder="https://example.org/blocklist.csv" required>
	</div>
</form>
