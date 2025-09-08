<p class="lead">[[admin/settings/activitypub:rules.modal.title]]</p>
<p>[[admin/settings/activitypub:rules.modal.instructions]]</p>

<hr />

<form role="form">
	<div class="mb-3">
		<label class="form-label" for="type">Type</label>
		<select class="form-control" name="type" id="type">
			<option value="hashtag">Hashtag</option>
			<option value="user">User</option>
			<!--<option value="content">Content contains...</option>-->
		</select>
	</div>
	<div class="mb-3">
		<label class="form-label" for="value">Value</label>
		<input type="text" id="value" name="value" title="Value" class="form-control" placeholder="forum">
		<p class="form-text" id="help-text"></p>
	</div>
	<div class="mb-3">
		<label class="form-label">Category</label>
		<div class="d-block">
			<!-- IMPORT admin/partials/category/selector-dropdown-left.tpl -->
		</div>
		<input type="hidden" name="cid" />
	</div>
</form>