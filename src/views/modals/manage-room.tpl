<div class="mb-3">
	<label class="form-label">[[modules:chat.add-user]]</label>
	<input class="form-control" type="text" placeholder="[[global:user-search-prompt]]" />
	<p class="text-danger"></p>
	<p class="form-text">[[modules:chat.add-user-help]]</p>

	<hr />

	<ul component="chat/manage/user/list" class="list-group overflow-auto pe-1" style="height: 300px;">
		<li class="list-group-item"><i class="fa fa-spinner fa-spin"></i> [[modules:chat.retrieving-users]]</li>
	</ul>
</div>