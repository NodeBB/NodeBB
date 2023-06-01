<li id="{./id}" data-plugin-id="{./id}" class="d-flex gap-1 justify-content-between text-bg-light border-start border-primary border-3 p-3 mb-2">
	<div class="">
		<h6><strong>{./name}</strong></h6>

		{{{ if ./description }}}
		<p class="text-xs">{./description}</p>
		{{{ end }}}

		<small>[[admin/extend/plugins:plugin-item.latest]] <strong class="latestVersion">{./latest}</strong></small>
		<p class="text-xs">
			{{{ if ./isCompatible }}}
			<i class="fa fa-check text-success"></i> [[admin/extend/plugins:plugin-item.compatible, {version}]]
			{{{ else }}}
			<i class="fa fa-question text-warning"></i> [[admin/extend/plugins:plugin-item.not-compatible]]
			{{{ end }}}
		</p>

		{{{ if ./url }}}
		<p class="text-xs mb-0">[[admin/extend/plugins:plugin-item.more-info]] <a target="_blank" href="{./url}">{./url}</a></p>
		{{{ end }}}
	</div>
	<div class="d-flex flex-column gap-1">
		<button data-action="toggleActive" class="btn btn-light btn-sm hidden text-nowrap">
			<i class="fa fa-power-off text-primary"></i> [[admin/extend/plugins:plugin-item.activate]]
		</button>

		<button data-action="toggleInstall" data-installed="0" class="btn btn-light btn-sm text-nowrap">
			<i class="fa fa-download text-primary"></i> [[admin/extend/plugins:plugin-item.install]]
		</button>
	</div>
</li>
