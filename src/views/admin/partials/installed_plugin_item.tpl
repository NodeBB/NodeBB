					<!-- IF !installed.error -->
					<li id="{installed.id}" data-plugin-index="@index" data-plugin-id="{installed.id}" data-version="{installed.version}" class="clearfix <!-- IF installed.active -->active<!-- ENDIF installed.active -->">
						<div class="pull-right controls">
							<!-- IF installed.isTheme -->
							<a href="{config.relative_path}/admin/appearance/themes" class="btn btn-info">[[admin/extend/plugins:plugin-item.themes]]</a>
							<!-- ELSE -->
							<button data-action="toggleActive" class="btn <!-- IF installed.active --> btn-warning<!-- ELSE --> btn-success<!-- ENDIF installed.active -->">
							<i class="fa fa-power-off"></i> <!-- IF installed.active -->[[admin/extend/plugins:plugin-item.deactivate]]<!-- ELSE -->[[admin/extend/plugins:plugin-item.activate]]<!-- ENDIF installed.active --></button>
							<!-- ENDIF installed.isTheme -->

							<button data-action="toggleInstall" data-installed="1" class="btn btn-danger"><i class="fa fa-trash-o"></i> [[admin/extend/plugins:plugin-item.uninstall]]</button>

							<!-- IF installed.active -->
							<!-- IF installed.settingsRoute -->
							<a href="{config.relative_path}{installed.settingsRoute}" class="btn btn-primary"><i class="fa fa-wrench"></i> [[admin/extend/plugins:plugin-item.settings]]</a>
							<!-- ENDIF installed.settingsRoute -->
							<!-- ENDIF installed.active -->
						</div>

						<h2><strong>{installed.name}</strong></h2>

						<!-- IF installed.description -->
						<p>{installed.description}</p>
						<!-- ENDIF installed.description -->
						<!-- IF installed.outdated --><i class="fa fa-exclamation-triangle text-danger"></i> <!-- ENDIF installed.outdated -->
						<small>[[admin/extend/plugins:plugin-item.installed]] <strong class="currentVersion">{installed.version}</strong> | [[admin/extend/plugins:plugin-item.latest]] <strong class="latestVersion">{installed.latest}</strong></small>
						<!-- IF installed.outdated -->
							<button data-action="upgrade" class="btn btn-success btn-xs"><i class="fa fa-download"></i> [[admin/extend/plugins:plugin-item.upgrade]]</button>
						<!-- ENDIF installed.outdated -->
						<!-- IF installed.url -->
						<p>[[admin/extend/plugins:plugin-item.more-info]] <a target="_blank" href="{installed.url}">{installed.url}</a></p>
						<!-- ENDIF installed.url -->
					</li>
					<!-- ENDIF !installed.error -->
					<!-- IF installed.error -->
					<li data-plugin-id="{installed.id}" class="clearfix">
						<div class="pull-right">
							<button class="btn btn-default disabled"><i class="fa fa-exclamation-triangle"></i> [[admin/extend/plugins:plugin-item.unknown]]</button>
							<button data-action="toggleInstall" data-installed="1" class="btn btn-danger"><i class="fa fa-trash-o"></i> [[admin/extend/plugins:plugin-item.uninstall]]</button>
						</div>

						<h2><strong>{installed.id}</strong></h2>
						<p>
							[[admin/extend/plugins:plugin-item.unknown-explanation]]
						</p>
					</li>
					<!-- ENDIF installed.error -->
