<p class="lead">{{tx("admin/settings/activitypub:rules.modal.title")}}</p>
<p>{{tx("admin/settings/activitypub:rules.modal.instructions")}}</p>

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
		<input type="text" id="value" name="value" title="Value" class="form-control" placeholder="forum" required>
		<p class="form-text" id="help-text"></p>
	</div>
	<div class="mb-3">
		<label class="form-label">Category</label>
		<div class="d-block">
			<!-- IMPORT admin/partials/category/selector-dropdown-left.tpl -->
		</div>
		<input type="hidden" name="cid" />
	</div>
	<div class="mb-3">
		<label class="form-label" for="action">{{tx("admin/settings/activitypub:rules.action")}}</label>
		<input type="range" class="form-range" name="action" id="action" min="0" max="2" value="0" />
		<div class="d-flex justify-content-between form-text" id="action-labels">
			<span>{{tx("admin/settings/activitypub:rules.categorize")}}</span>
			<span>{{tx("admin/settings/activitypub:rules.filter")}}</span>
			<span>{{tx("admin/settings/activitypub:rules.reject")}}</span>
		</div>
		<p class="form-text">{{tx("admin/settings/activitypub:rules.action.help")}}</p>
	</div>
</form>
