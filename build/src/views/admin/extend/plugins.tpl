{{{ if !canChangeState }}}
<div class="alert alert-warning">[[error:plugins-set-in-configuration]]</div>
{{{ end }}}
<ul class="nav nav-pills mb-3">
	<li class="nav-item">
		<button class="nav-link" data-bs-target="#trending" data-bs-toggle="tab">
			[[admin/extend/plugins:trending]]
			<i class="fa fa-star"></i>
		</button>
	</li>
	<li class="nav-item">
		<button class="nav-link active" data-bs-target="#installed" data-bs-toggle="tab">
			[[admin/extend/plugins:installed]]
			<span class="badge bg-light">{installedCount}</span>
		</button>
	</li>
	<li class="nav-item">
		<button class="nav-link" data-bs-target="#active" data-bs-toggle="tab">
			[[admin/extend/plugins:active]]
			<span class="badge bg-light">{activeCount}</span>
		</button>
	</li>
	<li class="nav-item">
		<button class="nav-link" data-bs-target="#deactive" data-bs-toggle="tab">
			[[admin/extend/plugins:inactive]]
			<span class="badge bg-light">{inactiveCount}</span>
		</button>
	</li>
	<li class="nav-item">
		<button class="nav-link" data-bs-target="#upgrade" data-bs-toggle="tab">
			[[admin/extend/plugins:out-of-date]]
			<span class="badge bg-light">{upgradeCount}</span>
		</button>
	</li>
	<li class="nav-item">
		<button class="nav-link" data-bs-target="#download" data-bs-toggle="tab">[[admin/extend/plugins:find-plugins]]</button>
	</li>
</ul>

<div class="plugins row">
	<div class="col-lg-9">
		<div class="tab-content">
			<div class="tab-pane fade" id="trending">
				<!-- IMPORT admin/partials/plugins/no-plugins.tpl -->
				<ul class="trending">
					{{{ each trending }}}
					<!-- IMPORT admin/partials/installed_plugin_item.tpl -->
					{{{ end }}}
				</ul>
			</div>
			<div class="tab-pane fade show active" id="installed">
				<!-- IMPORT admin/partials/plugins/no-plugins.tpl -->
				<ul class="installed">
					<!-- BEGIN installed -->
					<!-- IMPORT admin/partials/installed_plugin_item.tpl -->
					<!-- END installed -->
				</ul>
			</div>
			<div class="tab-pane fade" id="active">
				<!-- IMPORT admin/partials/plugins/no-plugins.tpl -->
				<ul class="active"></ul>
			</div>
			<div class="tab-pane fade" id="deactive">
				<!-- IMPORT admin/partials/plugins/no-plugins.tpl -->
				<ul class="deactive"></ul>
			</div>
			<div class="tab-pane fade" id="upgrade">
				<!-- IMPORT admin/partials/plugins/no-plugins.tpl -->
				<ul class="upgrade"></ul>
			</div>
			<div class="tab-pane fade" id="download">
				<!-- IMPORT admin/partials/plugins/no-plugins.tpl -->
				<ul class="download">
					<!-- BEGIN download -->
					<!-- IMPORT admin/partials/download_plugin_item.tpl -->
					<!-- END download -->
				</ul>
			</div>
		</div>
	</div>

	<div class="acp-sidebar col-lg-3">
		<div class="card">
			<div class="card-header">[[admin/extend/plugins:plugin-search]]</div>
			<div class="card-body">
				<input autofocus class="form-control" type="text" id="plugin-search" placeholder="[[admin/extend/plugins:plugin-search-placeholder]]"/><br/>
			</div>
		</div>

		<div class="card">
			<div class="card-body">
				<div class="form-check">
					<input id="plugin-submit-usage" class="form-check-input" type="checkbox" data-field="submitPluginUsage" <!-- IF submitPluginUsage -->checked<!-- ENDIF submitPluginUsage -->/>
					<label for="plugin-submit-usage" class="form-check-label">[[admin/extend/plugins:submit-anonymous-usage]]</label>
				</div>
			</div>
		</div>

		<div class="card">
			<div class="card-header">[[admin/extend/plugins:reorder-plugins]]</div>
			<div class="card-body d-grid">
				<button class="btn btn-outline-secondary" id="plugin-order">[[admin/extend/plugins:order-active]]</button>
			</div>
		</div>

		<div class="card">
			<div class="card-header">[[admin/extend/plugins:dev-interested]]</div>
			<div class="card-body">
				<p>
					[[admin/extend/plugins:docs-info]]
				</p>
			</div>
		</div>
	</div>

	<div class="modal fade" id="order-active-plugins-modal">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<h4 class="modal-title">[[admin/extend/plugins:order-active]]</h4>
					<button type="button" class="btn-close" data-bs-dismiss="modal" aria-hidden="true"></button>
				</div>
				<div class="modal-body">
					<p>
						[[admin/extend/plugins:order.description]]
					</p>
					<p>
						[[admin/extend/plugins:order.explanation]]
					</p>
					<ul class="plugin-list"></ul>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">[[global:buttons.close]]</button>
					<button type="button" class="btn btn-primary" id="save-plugin-order">[[global:save]]</button>
				</div>
			</div>
		</div>
	</div>
</div>


