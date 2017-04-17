					<li id="{download.id}" data-plugin-id="{download.id}" class="clearfix">
						<div class="pull-right">
							<button data-action="toggleActive" class="btn btn-success hidden"><i class="fa fa-power-off"></i> [[admin/extend/plugins:plugin-item.activate]]</button>
							<button data-action="toggleInstall" data-installed="0" class="btn btn-success"><i class="fa fa-download"></i> [[admin/extend/plugins:plugin-item.install]]</button>
						</div>

						<h2><strong>{download.name}</strong></h2>

						<!-- IF download.description -->
						<p>{download.description}</p>
						<!-- ENDIF download.description -->

						<small>[[admin/extend/plugins:plugin-item.latest]] <strong class="latestVersion">{download.latest}</strong></small>

						<!-- IF download.url -->
						<p>[[admin/extend/plugins:plugin-item.more-info]] <a target="_blank" href="{download.url}">{download.url}</a></p>
						<!-- ENDIF download.url -->
					</li>
