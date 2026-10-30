<div class="alert alert-danger hidden" id="create-modal-error"></div>
<form>
	<div class="mb-3">
		<label class="form-label" for="create-user-name">{{tx("admin/manage/users:create.username")}}</label>
		<input type="text" class="form-control" id="create-user-name" placeholder="{{tx("admin/manage/users:create.username")}}" />
	</div>
	<div class="mb-3">
		<label class="form-label" for="create-user-email">{{tx("admin/manage/users:create.email")}}</label>
		<input type="text" class="form-control" id="create-user-email" placeholder="{{tx("admin/manage/users:create.email-placeholder")}}" />
	</div>

	<div class="mb-3">
		<label class="form-label" for="create-user-password">{{tx("admin/manage/users:create.password")}}</label>
		<input type="password" class="form-control" id="create-user-password" placeholder="{{tx("admin/manage/users:create.password")}}" />
	</div>

	<div class="mb-3">
		<label class="form-label" for="create-user-password-again">{{tx("admin/manage/users:create.password-confirm")}}</label>
		<input type="password" class="form-control" id="create-user-password-again" placeholder="{{tx("admin/manage/users:create.password")}}" />
	</div>
</form>
