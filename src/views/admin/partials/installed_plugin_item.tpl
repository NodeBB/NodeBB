					{{{ if !./error }}}
					<li id="{./id}" data-plugin-index="{@index}" data-plugin-id="{./id}" data-version="{./version}" class="clearfix {{{ if ./active }}}active{{{ end }}}">
						<div class="float-end controls">
							{{{ if ./installed }}}
								{{{ if ./isTheme }}}
								<a href="{config.relative_path}/admin/appearance/themes" class="btn btn-info">[[admin/extend/plugins:plugin-item.themes]]</a>
								{{{ else }}}
								<button data-action="toggleActive" class="btn {{{ if ./active }}} btn-warning{{{ else }}} btn-success{{{ end }}} {{{ if !canChangeState }}}disabled{{{ end }}}">
								<i class="fa fa-power-off"></i> {{{ if ./active }}}[[admin/extend/plugins:plugin-item.deactivate]]{{{ else }}}[[admin/extend/plugins:plugin-item.activate]]{{{ end }}}</button>
								{{{ end }}}

								<button data-action="toggleInstall" data-installed="1" class="btn btn-danger"><i class="fa fa-trash-o"></i> [[admin/extend/plugins:plugin-item.uninstall]]</button>

								{{{ if ./active }}}
								{{{ if ./settingsRoute }}}
								<a href="{config.relative_path}{./settingsRoute}" class="btn btn-primary"><i class="fa fa-wrench"></i> [[admin/extend/plugins:plugin-item.settings]]</a>
								{{{ end }}}
								{{{ end }}}
							{{{ else }}}
								<button data-action="toggleInstall" data-installed="0" class="btn btn-success"><i class="fa fa-download"></i> [[admin/extend/plugins:plugin-item.install]]</button>
							{{{ end }}}
						</div>

						<h2><strong>{./name}</strong></h2>

						{{{ if ./description }}}
						<p>{./description}</p>
						{{{ end }}}
						{{{ if ./outdated }}}<i class="fa fa-exclamation-triangle text-danger"></i> {{{ end }}}
						<small>[[admin/extend/plugins:plugin-item.installed]] <strong class="currentVersion">{./version}</strong> | [[admin/extend/plugins:plugin-item.latest]] <strong class="latestVersion">{./latest}</strong></small>

						{{{ if ./outdated }}}
						<button data-action="upgrade" class="btn btn-success btn-sm"><i class="fa fa-download"></i> [[admin/extend/plugins:plugin-item.upgrade]]</button>
						<p>
							{{{ if ./isCompatible }}}
							<i class="fa fa-check text-success"></i> [[admin/extend/plugins:plugin-item.compatible, {version}]]
							{{{ else }}}
							<i class="fa fa-question text-warning"></i> [[admin/extend/plugins:plugin-item.not-compatible]]
							{{{ end }}}
						</p>
						{{{ end }}}

						{{{ if ./url }}}
						<p>[[admin/extend/plugins:plugin-item.more-info]] <a target="_blank" href="{./url}">{./url}</a></p>
						{{{ end }}}
					</li>
					{{{ end }}}
					{{{ if ./error }}}
					<li data-plugin-id="{./id}" class="clearfix">
						<div class="float-end">
							<button class="btn btn-outline-secondary disabled"><i class="fa fa-exclamation-triangle"></i> [[admin/extend/plugins:plugin-item.unknown]]</button>
							<button data-action="toggleInstall" data-installed="1" class="btn btn-danger"><i class="fa fa-trash-o"></i> [[admin/extend/plugins:plugin-item.uninstall]]</button>
						</div>

						<h2><strong>{./id}</strong></h2>
						<p>
							[[admin/extend/plugins:plugin-item.unknown-explanation]]
						</p>
					</li>
					{{{ end }}}
