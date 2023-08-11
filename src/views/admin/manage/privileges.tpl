<div class="d-flex flex-column gap-2 px-lg-4">

	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/manage/privileges:manage-privileges]]</h4>
		</div>
		<div class="d-flex gap-1">
			<button id="discard" class="btn btn-light btn-sm text-nowrap" type="button">
				<i class="fa fa-rotate-left text-danger"></i> [[admin/manage/privileges:discard-changes]]
			</button>

			<button id="save" class="btn btn-primary btn-sm fw-semibold ff-secondary w-100 text-center text-nowrap">[[admin/admin:save-changes]]</button>
		</div>
	</div>

	<div class="row">
		<div class="col-12">
			<form role="form" class="category">
				<div class="">
					<p>
						[[admin/manage/categories:privileges.description]]
					</p>

					<div class="lead mb-3">
						[[admin/manage/categories:privileges.category-selector]]
						<!-- IMPORT admin/partials/category/selector-dropdown-left.tpl -->
					</div>

					<div class="privilege-table-container">
						{{{ if cid }}}
						<!-- IMPORT admin/partials/privileges/category.tpl -->
						{{{ else }}}
						<!-- IMPORT admin/partials/privileges/global.tpl -->
						{{{ end }}}
					</div>
				</div>
			</form>
		</div>
	</div>
</div>