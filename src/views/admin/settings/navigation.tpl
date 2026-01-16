<div class="navigation d-flex flex-column gap-2 px-lg-4">
	<div class="d-flex border-bottom py-2 m-0 sticky-top acp-page-main-header align-items-center justify-content-between flex-wrap gap-2">
		<div class="">
			<h4 class="fw-bold tracking-tight mb-0">[[admin/settings/navigation:navigation]]</h4>
		</div>
		<div class="d-flex gap-1">

			<button id="save" class="btn btn-primary btn-sm fw-semibold ff-secondary w-100 text-center text-nowrap">[[admin/admin:save-changes]]</button>
		</div>
	</div>



	<div class="row" id="navigation">
		<div class="col-lg-9">
			<div class="clearfix">
				<ul id="active-navigation" class="nav border">
					{{{ each navigation }}}
					<li data-index="{navigation.index}" class="float-start nav-item {navigation.class} {{{ if navigation.selected }}} active {{{ end }}}">
						<a href="#" title="{navigation.route}" id="{navigation.id}" class="nav-link p-3 {{{ if !navigation.enabled }}}text-muted{{{ end }}}">
							<i class="nav-icon fa fa-fw {{{ if navigation.iconClass }}}{navigation.iconClass}{{{ end }}}"></i><i class="dropdown-icon fa fa-caret-down{{{ if !navigation.dropdown }}} hidden{{{ end }}}"></i>
						</a>
					</li>
					{{{ end }}}
				</ul>
			</div>

			<hr/>

			<ul id="enabled">
				{{{ each enabled }}}
				<li data-index="{enabled.index}" class="card card-body text-bg-light border-0 {{{ if !enabled.selected }}}hidden{{{ end }}}">
					<form>
						<div class="row mb-3">
							<div class="col-sm-1">
								<label class="form-label">[[admin/settings/navigation:icon]]</label>
								<span class="iconPicker"><i class="fa fa-2x {enabled.iconClass}"></i>
									<a class="change-icon-link {{{ if enabled.iconClass }}}hidden{{{ end }}}" href="#">[[admin/settings/navigation:change-icon]]</a>
									<input class="form-control" type="hidden" name="iconClass" value="{enabled.iconClass}" />
								</span>
							</div>

							<div class="col-sm-3">
								<label class="form-label" for="nav:route">[[admin/settings/navigation:route]]</label>
								<input id="nav:route" class="form-control" type="text" name="route" value="{enabled.route}" />
							</div>

							<div class="col-sm-4">
								<label class="form-label" for="nav:class">[[admin/settings/navigation:class]]</label>
								<input id="nav:class" class="form-control" type="text" name="class" value="{enabled.class}" />
							</div>

							<div class="col-sm-4">
								<label class="form-label" for="nav:id">[[admin/settings/navigation:id]]</label>
								<input id="nav:id" class="form-control" type="text" name="id" value="{enabled.id}" />
							</div>
						</div>

						<div class="row mb-3">
							<div class="col-sm-4">
								<label class="form-label" for="nav:text">[[admin/settings/navigation:text]]</label>
								<input id="nav:text" class="form-control unescape" type="text" name="text" value="{enabled.text}" />
							</div>

							<div class="col-sm-4">
								<label class="form-label" for="nav:text-class">[[admin/settings/navigation:text-class]]</label>
								<input id="nav:text-class" class="form-control" type="text" name="textClass" value="{enabled.textClass}" />
							</div>

							<div class="col-sm-4">
								<label class="form-label" for="nav:tooltip">[[admin/settings/navigation:tooltip]]</label>
								<input id="nav:tooltip" class="form-control unescape" type="text" name="title" value="{enabled.title}" />
							</div>
						</div>

						<div class="row mb-3">
							<div class="col-12">
								<label class="form-label">[[admin/settings/navigation:show-to-groups]]</label>

								<select name="groups" class="form-select" size="10" multiple>
									{{{ each enabled.groups }}}
									<option value="{enabled.groups.displayName}"{{{ if enabled.groups.selected }}} selected{{{ end }}}>{enabled.groups.displayName}</option>
									{{{ end }}}
								</select>
							</div>
						</div>

						<div class="form-check form-switch mb-3">
							<input class="form-check-input" type="checkbox" id="targetBlank-{./index}" name="targetBlank" {{{ if enabled.targetBlank }}}checked{{{ end }}}/>
							<label for="targetBlank-{./index}" class="form-check-label">[[admin/settings/navigation:open-new-window]]</label>
						</div>

						<div class="form-check form-switch mb-3">
							<input class="form-check-input" type="checkbox" id="dropdown-{./index}" name="dropdown" {{{ if enabled.dropdown }}}checked{{{ end }}}/>
							<label for="dropdown-{./index}" class="form-check-label">[[admin/settings/navigation:dropdown]]</label>
						</div>
						<div class="mb-3">
							<p class="form-text">
								[[admin/settings/navigation:dropdown-placeholder]]
							</p>
							<textarea name="dropdownContent" rows="5" class="form-control">{enabled.dropdownContent}</textarea>
						</div>
						<div class="row">
							<div class="col-sm-12 text-end">

								<button class="btn btn-light btn-sm toggle disable {{{ if !enabled.enabled }}}hidden{{{ end }}}"><i class="fa fa-ban text-danger"></i> [[admin/settings/navigation:btn.disable]]</button>

								<button class="btn btn-light btn-sm toggle enable {{{ if enabled.enabled }}}hidden{{{ end }}}"><i class="fa fa-check text-success"></i> [[admin/settings/navigation:btn.enable]]</button>

								<button class="btn btn-danger btn-sm delete">[[admin/settings/navigation:btn.delete]]</button>
								<input type="hidden" name="enabled" value="{{{ if enabled.enabled }}}on{{{ end}}}" />
							</div>
						</div>
					</form>
				</li>
				{{{ end }}}
			</ul>
		</div>

		<div class="col-lg-3">
			<div class="card">
				<div class="card-header">[[admin/settings/navigation:available-menu-items]]</div>
				<div class="card-body">
					<ul id="available">
						<li data-id="custom" class="clearfix d-flex align-items-center gap-3 mb-3">
							<div data-id="custom" class="drag-item alert p-2 mb-0 alert-success">
								<i class="fa fa-fw fa-plus-circle"></i>
							</div>
							<p>
								<strong>[[admin/settings/navigation:custom-route]]</strong>
							</p>
						</li>
						{{{ each available }}}
						<li data-id="{@index}" class="clearfix d-flex align-items-center gap-3 mb-3">
							<div data-id="{@index}" class="drag-item alert p-2 mb-0 {{{ if available.core }}}alert-warning{{{ else }}}alert-info{{{ end }}}">
								<i class="fa fa-fw {{{ if available.iconClass }}}{available.iconClass}{{{ else }}}fa-navicon{{{ end }}}"></i>
							</div>
							<div class="d-flex flex-column">
								<p class="mb-0">
									<strong>{available.text}</strong>
								</p>
								<p class="mb-0">
									{{{ if available.core }}}
									<span class="badge bg-primary-subtle text-primary">[[admin/settings/navigation:core]]</span>
									{{{ else }}}
									<span class="badge bg-secondary-subtle text-secondary">[[admin/settings/navigation:plugin]]</span>
									{{{ end }}}
									<span class="badge text-bg-none"><code>{available.route}</code></span>
								</p>
							</div>
						</li>
						{{{ end }}}
					</ul>
				</div>
			</div>
		</div>
	</div>
</div>
