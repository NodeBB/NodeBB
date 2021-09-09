					<!-- IF !../error -->
					<li id="{../id}" data-plugin-index="{@index}" data-plugin-id="{../id}" data-version="{../version}" class="clearfix <!-- IF ../active -->active<!-- ENDIF ../active -->">
						<div class="pull-right controls">
							{{{ if ../installed }}}
								<!-- IF ../isTheme -->
								<a href="{config.relative_path}/admin/appearance/themes" class="btn btn-info">[[admin/extend/plugins:plugin-item.themes]]</a>
								<!-- ELSE -->
								<button data-action="toggleActive" class="btn <!-- IF ../active --> btn-warning<!-- ELSE --> btn-success<!-- ENDIF ../active -->">
								<i class="fa fa-power-off"></i> <!-- IF ../active -->[[admin/extend/plugins:plugin-item.deactivate]]<!-- ELSE -->[[admin/extend/plugins:plugin-item.activate]]<!-- ENDIF ../active --></button>
								<!-- ENDIF ../isTheme -->

								<button data-action="toggleInstall" data-installed="1" class="btn btn-danger"><i class="fa fa-trash-o"></i> [[admin/extend/plugins:plugin-item.uninstall]]</button>

								<!-- IF ../active -->
								<!-- IF ../settingsRoute -->
								<a href="{config.relative_path}{../settingsRoute}" class="btn btn-primary"><i class="fa fa-wrench"></i> [[admin/extend/plugins:plugin-item.settings]]</a>
								<!-- ENDIF ../settingsRoute -->
								<!-- ENDIF ../active -->
							{{{ else }}}
								<button data-action="toggleInstall" data-installed="0" class="btn btn-success"><i class="fa fa-download"></i> [[admin/extend/plugins:plugin-item.install]]</button>
							{{{ end }}}
						</div>

						<h2><strong>{../name}</strong></h2>

						<!-- IF ../description -->
						<p>{../description}</p>
						<!-- ENDIF ../description -->
						<!-- IF ../outdated --><i class="fa fa-exclamation-triangle text-danger"></i> <!-- ENDIF ../outdated -->
						<small>[[admin/extend/plugins:plugin-item.installed]] <strong class="currentVersion">{../version}</strong> | [[admin/extend/plugins:plugin-item.latest]] <strong class="latestVersion">{../latest}</strong></small>

						<!-- IF ../outdated -->
						<button data-action="upgrade" class="btn btn-success btn-xs"><i class="fa fa-download"></i> [[admin/extend/plugins:plugin-item.upgrade]]</button>
						<p>
							<!-- IF ../isCompatible -->
							<i class="fa fa-check text-success"></i> [[admin/extend/plugins:plugin-item.compatible, {version}]]
							<!-- ELSE -->
							<i class="fa fa-question text-warning"></i> [[admin/extend/plugins:plugin-item.not-compatible]]
							<!-- ENDIF -->
						</p>
						<!-- ENDIF ../outdated -->

						<!-- IF ../url -->
						<p>[[admin/extend/plugins:plugin-item.more-info]] <a target="_blank" href="{../url}">{../url}</a></p>
						<!-- ENDIF ../url -->
					</li>
					<!-- ENDIF !../error -->
					<!-- IF ../error -->
					<li data-plugin-id="{../id}" class="clearfix">
						<div class="pull-right">
							<button class="btn btn-default disabled"><i class="fa fa-exclamation-triangle"></i> [[admin/extend/plugins:plugin-item.unknown]]</button>
							<button data-action="toggleInstall" data-installed="1" class="btn btn-danger"><i class="fa fa-trash-o"></i> [[admin/extend/plugins:plugin-item.uninstall]]</button>
						</div>

						<h2><strong>{../id}</strong></h2>
						<p>
							[[admin/extend/plugins:plugin-item.unknown-explanation]]
						</p>
					</li>
					<!-- ENDIF ../error -->
