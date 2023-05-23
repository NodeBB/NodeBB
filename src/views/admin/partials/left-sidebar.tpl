<div id="left-sidebar" style="width:240px;" class="vh-100 sticky-top start-0 d-none d-lg-flex text-bg-light p-2 flex-column justify-content-start text-sm border-end">

	<div class="d-flex flex-column gap-1 ff-secondary">
		<a href="{config.relative_path}/" class="btn-ghost fw-semibold text-decoration-none justify-content-start"><i class="fa fa-fw fa-home text-muted"></i> [[admin/menu:view-forum]]</a>

		<!-- IMPORT admin/partials/search.tpl -->
	</div>
	<div class="d-flex flex-column gap-1 ff-secondary flex-1 overflow-auto">
		<!-- IMPORT admin/partials/navigation.tpl -->
	</div>

	<div class="d-flex flex-column gap-1 ff-secondary">
		<hr/>
		{{{ if user.privileges.superadmin }}}
		<button component="rebuild-and-restart" class="btn-ghost fw-semibold text-decoration-none justify-content-start" ><i class="fa fa-fw fa-refresh"></i> [[admin/menu:rebuild-and-restart]]</button>

		<button component="restart" class="btn-ghost fw-semibold text-decoration-none justify-content-start" ><i class="fa fa-fw fa-repeat"></i> [[admin/menu:restart]]</button>
		{{{ end }}}

		<button component="logout" class="btn-ghost fw-semibold text-decoration-none justify-content-start" ><i class="fa fw-fw fa-sign-out"></i> [[admin/menu:logout]]</button>
	</div>
</div>
