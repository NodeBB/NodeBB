<div class="offcanvas offcanvas-start" tabindex="-1" id="offcanvas" aria-labelledby="offcanvasLabel" style="width: 275px;">
	<div class="offcanvas-header">
		<h5 class="offcanvas-title" id="offcanvasLabel">{config.siteTitle}</h5>
		<button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
	</div>
	<div class="offcanvas-body flex-0 py-0 overflow-visible d-flex flex-column gap-1 ff-secondary">
		<!-- IMPORT admin/partials/quick_actions/alerts.tpl -->

		<a href="{config.relative_path}/" class="btn-ghost fw-semibold text-decoration-none justify-content-start"><i class="fa fa-fw fa-home"></i> [[admin/menu:view-forum]]</a>

		<!-- IMPORT admin/partials/search.tpl -->
	</div>

	<div class="offcanvas-body d-flex flex-column overflow-hidden">
		<div class="d-flex flex-column gap-1 ff-secondary flex-1 overflow-auto">
			<!-- IMPORT admin/partials/navigation.tpl -->
		</div>
		<hr class="my-1"/>
		<!-- IMPORT admin/partials/quick_actions/buttons.tpl -->
	</div>
</div>