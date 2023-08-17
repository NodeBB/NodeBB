<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<div id="pagination" class="mb-4">
				<h5 class="fw-bold tracking-tight settings-header hidden">[[admin/settings/pagination:pagination]]</h5>
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" id="usePagination" data-field="usePagination">
					<label for="usePagination" class="form-check-label">[[admin/settings/pagination:enable]]</label>
				</div>

				<div class="mb-3">
					<label class="form-label">[[admin/settings/pagination:posts-per-page]]</label>
					<input type="text" class="form-control" value="20" data-field="postsPerPage">
				</div>
				<div class="mb-3">
					<label class="form-label">[[admin/settings/pagination:max-posts-per-page]]</label>
					<input type="text" class="form-control" value="20" data-field="maxPostsPerPage">
				</div>

				<div class="mb-3">
					<label class="form-label">[[admin/settings/pagination:topics-per-page]]</label>
					<input type="text" class="form-control" value="20" data-field="topicsPerPage">
				</div>
				<div class="mb-3">
					<label class="form-label">[[admin/settings/pagination:max-topics-per-page]]</label>
					<input type="text" class="form-control" value="20" data-field="maxTopicsPerPage">
				</div>

				<div>
					<label class="form-label">[[admin/settings/pagination:categories-per-page]]</label>
					<input type="text" class="form-control" value="50" data-field="categoriesPerPage">
				</div>
			</div>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>
