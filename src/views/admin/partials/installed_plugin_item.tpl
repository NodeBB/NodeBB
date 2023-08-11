{{{ if !./error }}}
<li id="{./id}" data-plugin-index="{@index}" data-plugin-id="{./id}" data-version="{./version}" class="d-flex gap-1 justify-content-between text-bg-light border-start border-primary border-3 p-3 mb-2 {{{ if ./active }}}active{{{ end }}}">
	<div>
		<h6><strong>{./name}</strong></h6>

		{{{ if ./description }}}
		<p class="text-xs">{./description}</p>
		{{{ end }}}
		{{{ if ./outdated }}}<i class="fa fa-exclamation-triangle text-danger"></i> {{{ end }}}
		<small>[[admin/extend/plugins:plugin-item.installed]] <strong class="currentVersion">{./version}</strong> | [[admin/extend/plugins:plugin-item.latest]] <strong class="latestVersion">{./latest}</strong></small>

		{{{ if ./outdated }}}
		<button data-action="upgrade" class="btn btn-success btn-sm"><i class="fa fa-download"></i> [[admin/extend/plugins:plugin-item.upgrade]]</button>
		<p class="text-xs">
			{{{ if ./isCompatible }}}
			<i class="fa fa-check text-success"></i> [[admin/extend/plugins:plugin-item.compatible, {version}]]
			{{{ else }}}
			<i class="fa fa-question text-warning"></i> [[admin/extend/plugins:plugin-item.not-compatible]]
			{{{ end }}}
		</p>
		{{{ end }}}

		{{{ if ./url }}}
		<p class="text-xs mb-0">[[admin/extend/plugins:plugin-item.more-info]] <a target="_blank" href="{./url}">{./url}</a></p>
		{{{ end }}}
	</div>

	<div class="controls d-flex flex-column gap-1">
		{{{ if ./installed }}}
			{{{ if ./isTheme }}}
			<a href="{config.relative_path}/admin/appearance/themes" class="btn btn-light btn-sm text-nowrap"><i class="fa fa-arrow-up-right-from-square text-primary"></i> [[admin/extend/plugins:plugin-item.themes]]</a>
			{{{ else }}}

			<button data-action="toggleActive" class="btn btn-light btn-sm text-nowrap {{{ if !./active }}}hidden{{{ end }}} {{{ if !canChangeState }}}disabled{{{ end }}}">
				<i class="fa fa-power-off text-danger"></i> [[admin/extend/plugins:plugin-item.deactivate]]
			</button>

			<button data-action="toggleActive" class="btn btn-light btn-sm text-nowrap {{{ if ./active }}}hidden{{{ end }}} {{{ if !canChangeState }}}disabled{{{ end }}}">
				<i class="fa fa-power-off text-primary"></i> [[admin/extend/plugins:plugin-item.activate]]
			</button>

			{{{ end }}}

			<button data-action="toggleInstall" data-installed="1" class="btn btn-light btn-sm text-nowrap"><i class="fa fa-trash text-danger"></i> [[admin/extend/plugins:plugin-item.uninstall]]</button>

			{{{ if ./active }}}
			{{{ if ./settingsRoute }}}
			<a href="{config.relative_path}{./settingsRoute}" class="btn btn-light btn-sm text-nowrap"><i class="fa fa-wrench text-primary"></i> [[admin/extend/plugins:plugin-item.settings]]</a>
			{{{ end }}}
			{{{ end }}}
		{{{ else }}}
			<button data-action="toggleInstall" data-installed="0" class="btn btn-light btn-sm text-nowrap"><i class="fa fa-download text-primary"></i> [[admin/extend/plugins:plugin-item.install]]</button>
		{{{ end }}}
	</div>

</li>
{{{ end }}}

{{{ if ./error }}}
<li data-plugin-id="{./id}" class="clearfix">
	<div class="float-end">
		<button class="btn btn-light btn-sm disabled"><i class="fa fa-exclamation-triangle"></i> [[admin/extend/plugins:plugin-item.unknown]]</button>
		<button data-action="toggleInstall" data-installed="1" class="btn btn-light btn-sm"><i class="fa fa-trash text-danger"></i> [[admin/extend/plugins:plugin-item.uninstall]]</button>
	</div>

	<h2><strong>{./id}</strong></h2>
	<p class="text-xs">
		[[admin/extend/plugins:plugin-item.unknown-explanation]]
	</p>
</li>
{{{ end }}}
