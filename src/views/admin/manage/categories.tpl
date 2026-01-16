<div class="acp-page-container">
	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/manage/categories:manage-categories]]</h4>
		</div>
		<div class="d-flex gap-1">
			<button id="toggle-collapse-all" class="btn btn-ghost btn-sm text-nowrap" data-collapsed="0">[[admin/manage/categories:collapse-all]]</button>

			<!-- IMPORT admin/partials/category/selector-dropdown-right.tpl -->

			<div class="btn-group" role="group">
				<button class="btn btn-primary btn-sm btn btn-primary btn-sm fw-semibold ff-secondary text-center text-nowrap dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
					[[admin/manage/categories:add-category]]
					<i class="fa fa-caret-down"></i>
				</button>
				<ul class="dropdown-menu">
					<li><button class="btn-link dropdown-item" href="#" data-action="create">[[admin/manage/categories:add-local-category]]</button></li>
					<li><button class="btn-link dropdown-item" href="#" data-action="add">[[admin/manage/categories:add-remote-category]]</button></li>
				</ul>
			</div>
		</div>
	</div>
	<div class="text-sm {{{if !breadcrumbs.length }}}hidden{{{ end }}}"><!-- IMPORT admin/partials/breadcrumbs.tpl --></div>

	<div component="category/no-matches" class="hidden">[[admin/manage/categories:no-matches]]</div>

	<div class="categories"></div>

	<div>
		<!-- IMPORT admin/partials/paginator.tpl -->
	</div>
</div>
