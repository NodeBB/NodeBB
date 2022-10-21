<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/pagination:pagination]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="form-check">
				<input class="form-check-input" type="checkbox" data-field="usePagination">
				<label class="form-check-label">[[admin/settings/pagination:enable]]</label>
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/pagination:posts]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="mb-3">
				<label class="form-label">[[admin/settings/pagination:posts-per-page]]</label>
				<input type="text" class="form-control" value="20" data-field="postsPerPage">
			</div>
			<div class="mb-3">
				<label class="form-label">[[admin/settings/pagination:max-posts-per-page]]</label>
				<input type="text" class="form-control" value="20" data-field="maxPostsPerPage">
			</div>
		</form>
	</div>
</div>

<div class="row mb-4">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/pagination:topics]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div class="mb-3">
				<label class="form-label">[[admin/settings/pagination:topics-per-page]]</label>
				<input type="text" class="form-control" value="20" data-field="topicsPerPage">
			</div>
			<div class="mb-3">
				<label class="form-label">[[admin/settings/pagination:max-topics-per-page]]</label>
				<input type="text" class="form-control" value="20" data-field="maxTopicsPerPage">
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-12 settings-header">[[admin/settings/pagination:categories]]</div>
	<div class="col-sm-10 col-12">
		<form>
			<div>
				<label class="form-label">[[admin/settings/pagination:categories-per-page]]</label>
				<input type="text" class="form-control" value="50" data-field="categoriesPerPage">
			</div>
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->