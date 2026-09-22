<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row settings m-0">
		<div id="spy-container" class="col-12 col-md-8 px-0 mb-4" tabindex="0">
			<form role="form" class="meta-tags-settings">
				<div class="mb-4">
					<h5 class="fw-bold tracking-tight settings-header">{{tx("admin/settings/meta-tags:custom-tags")}}</h5>
					<p class="lead">{{tx("admin/settings/meta-tags:description")}}</p>

					<div class="d-flex gap-2 mb-2 text-xs text-muted">
						<span class="form-label" style="flex: 0 0 200px;">{{tx("admin/settings/meta-tags:key")}}</span>
						<span class="form-label" style="flex: 1;">{{tx("admin/settings/meta-tags:content")}}</span>
					</div>

					<div id="meta-tags-list">
						{{{ each tags }}}
						<div class="meta-tag-row d-flex gap-2 mb-2" data-type="meta-tag-row">
							<input type="text" class="form-control meta-tag-key" style="flex: 0 0 200px;" placeholder="og:title" value="{./key}" />
							<input type="text" class="form-control meta-tag-content" name="{./key}" style="flex: 1;" placeholder="My Site" value="{./content}" />
							<button type="button" class="btn btn-sm btn-outline-danger" data-action="remove-tag" title="{{tx("admin/settings/meta-tags:remove")}}"><i class="fa fa-times"></i></button>
						</div>
						{{{ end }}}
					</div>

					<button type="button" id="add-meta-tag" class="btn btn-sm btn-info" data-action="add-tag">{{tx("admin/settings/meta-tags:add-tag")}}</button>
				</div>
			</form>
		</div>

		<!-- IMPORT admin/partials/settings/toc.tpl -->
	</div>
</div>
