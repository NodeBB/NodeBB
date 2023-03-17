					<li id="{./id}" data-plugin-id="{./id}" class="clearfix">
						<div class="float-end">
							<button data-action="toggleActive" class="btn btn-success hidden"><i class="fa fa-power-off"></i> [[admin/extend/plugins:plugin-item.activate]]</button>
							<button data-action="toggleInstall" data-installed="0" class="btn btn-success"><i class="fa fa-download"></i> [[admin/extend/plugins:plugin-item.install]]</button>
						</div>

						<h2><strong>{./name}</strong></h2>

						{{{ if ./description }}}
						<p>{./description}</p>
						{{{ end }}}

						<small>[[admin/extend/plugins:plugin-item.latest]] <strong class="latestVersion">{./latest}</strong></small>
						<p>
							{{{ if ./isCompatible }}}
							<i class="fa fa-check text-success"></i> [[admin/extend/plugins:plugin-item.compatible, {version}]]
							{{{ else }}}
							<i class="fa fa-question text-warning"></i> [[admin/extend/plugins:plugin-item.not-compatible]]
							{{{ end }}}
						</p>

						{{{ if ./url }}}
						<p>[[admin/extend/plugins:plugin-item.more-info]] <a target="_blank" href="{./url}">{./url}</a></p>
						{{{ end }}}
					</li>
