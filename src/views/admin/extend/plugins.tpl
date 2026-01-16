<div class="d-flex flex-column gap-2 px-lg-4 {{{ if isStarterPlan }}}opacity-75 pe-none{{{ end }}}">
	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/extend/plugins:plugins]]</h4>
		</div>
		<div class="d-flex align-items-center gap-1">
			<input {{{ if !isStarterPlan}}} autofocus{{{ end}}} class="form-control form-control-sm" type="text" id="plugin-search" placeholder="[[admin/extend/plugins:plugin-search-placeholder]]"/><br/>
			<button class="btn btn-primary btn-sm text-nowrap" id="plugin-order">[[admin/extend/plugins:order-active]]</button>
		</div>
	</div>
	<div>
		{{{ if !canChangeState }}}
		<div class="alert alert-warning">[[error:plugins-set-in-configuration]]</div>
		{{{ end }}}
		<ul class="nav nav-pills mb-3" id="plugin-tabs">
			<li class="nav-item">
				<button class="nav-link" data-bs-target="#trending" data-bs-toggle="tab">
					[[admin/extend/plugins:trending]]
					<i class="fa fa-star"></i>
				</button>
			</li>
			<li class="nav-item">
				<button class="nav-link active" data-bs-target="#installed" data-bs-toggle="tab">
					[[admin/extend/plugins:installed]]
					<span class="badge text-bg-light">{installedCount}</span>
				</button>
			</li>
			<li class="nav-item">
				<button class="nav-link" data-bs-target="#active" data-bs-toggle="tab">
					[[admin/extend/plugins:active]]
					<span class="badge text-bg-light">{activeCount}</span>
				</button>
			</li>
			<li class="nav-item">
				<button class="nav-link" data-bs-target="#deactive" data-bs-toggle="tab">
					[[admin/extend/plugins:inactive]]
					<span class="badge text-bg-light">{inactiveCount}</span>
				</button>
			</li>
			<li class="nav-item">
				<button class="nav-link" data-bs-target="#upgrade" data-bs-toggle="tab">
					[[admin/extend/plugins:out-of-date]]
					<span class="badge text-bg-light">{upgradeCount}</span>
				</button>
			</li>
			<li class="nav-item">
				<button class="nav-link" data-bs-target="#download" data-bs-toggle="tab">[[admin/extend/plugins:find-plugins]]</button>
			</li>
		</ul>

		<div class="plugins row px-2">
			<div class="col-lg-9">
				<div class="tab-content">
					<div class="tab-pane fade" id="trending">
						<div class="alert alert-info no-plugins {{{ if !trending.length }}}hide{{{ end }}}">[[admin/extend/plugins:none-found]]</div>
						<ul class="trending list-unstyled">
							{{{ each trending }}}
							<!-- IMPORT admin/partials/installed_plugin_item.tpl -->
							{{{ end }}}
						</ul>
					</div>
					<div class="tab-pane fade show active" id="installed">
						<div class="alert alert-info no-plugins {{{ if installed.length }}}hide{{{ end }}}">[[admin/extend/plugins:none-found]]</div>
						<ul class="installed list-unstyled">
							{{{ each installed }}}
							<!-- IMPORT admin/partials/installed_plugin_item.tpl -->
							{{{ end }}}
						</ul>
					</div>
					<div class="tab-pane fade" id="active">
						<div class="alert alert-info no-plugins {{{ if active.length }}}hide{{{ end }}}">[[admin/extend/plugins:none-found]]</div>
						<ul class="active list-unstyled">
							{{{ each active }}}
							<!-- IMPORT admin/partials/installed_plugin_item.tpl -->
							{{{ end }}}
						</ul>
					</div>
					<div class="tab-pane fade" id="deactive">
						<div class="alert alert-info no-plugins {{{ if inactive.length }}}hide{{{ end }}}">[[admin/extend/plugins:none-found]]</div>
						<ul class="deactive list-unstyled">
							{{{ each inactive }}}
							<!-- IMPORT admin/partials/installed_plugin_item.tpl -->
							{{{ end }}}
						</ul>
					</div>
					<div class="tab-pane fade" id="upgrade">
						<div class="alert alert-info no-plugins {{{ if upgrade.length }}}hide{{{ end }}}">[[admin/extend/plugins:none-found]]</div>
						<ul class="upgrade list-unstyled">
							{{{ each upgrade }}}
							<!-- IMPORT admin/partials/installed_plugin_item.tpl -->
							{{{ end }}}
						</ul>
					</div>
					<div class="tab-pane fade" id="download">
						<div class="alert alert-info no-plugins {{{ if download.length }}}hide{{{ end }}}">[[admin/extend/plugins:none-found]]</div>
						<ul class="download list-unstyled">
							{{{ each download }}}
							<!-- IMPORT admin/partials/download_plugin_item.tpl -->
							{{{ end }}}
						</ul>
					</div>
				</div>
			</div>

			<div class="acp-sidebar col-lg-3">
				<div class="card">
					<div class="card-body">
						<div class="form-check form-switch text-sm">
							<input id="plugin-submit-usage" class="form-check-input" type="checkbox" data-field="submitPluginUsage" {{{ if submitPluginUsage }}}checked{{{ end }}}/>
							<label for="plugin-submit-usage" class="form-check-label">[[admin/extend/plugins:submit-anonymous-usage]]</label>
						</div>
						<hr/>
						<div>
							<div class="fw-semibold text-sm">[[admin/extend/plugins:dev-interested]]</div>
							<p class="text-xs text-muted">
								[[admin/extend/plugins:docs-info]]
							</p>
						</div>
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
							<ul class="plugin-list list-unstyled d-flex flex-column gap-2"></ul>
						</div>
						<div class="modal-footer">
							<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">[[global:buttons.close]]</button>
							<button type="button" class="btn btn-primary" id="save-plugin-order">[[global:save]]</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
