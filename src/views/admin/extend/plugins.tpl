<div class="plugins">
	<div class="col-sm-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-code-fork"></i> Installed Plugins</div>
			<div class="panel-body">
				<ul>
					<!-- BEGIN plugins -->
					<!-- IF plugins.installed -->
					<li data-plugin-id="{plugins.id}" class="clearfix">
						<div class="pull-right">
							<button data-action="toggleActive" class="btn <!-- IF plugins.active --> btn-warning<!-- ELSE --> btn-success<!-- ENDIF plugins.active -->"><i class="fa fa-power-off"></i> <!-- IF plugins.active -->Deactivate<!-- ELSE -->Activate<!-- ENDIF plugins.active --></button>

							<button data-action="toggleInstall" class="btn btn-danger"><i class="fa fa-trash-o"></i> Uninstall</button>
						</div>

						<h2><strong>{plugins.name}</strong></h2>

						<!-- IF plugins.description -->
						<p>{plugins.description}</p>
						<!-- ENDIF plugins.description -->
						<!-- IF plugins.url -->
						<p>For more information: <a href="{plugins.url}">{plugins.url}</a></p>
						<!-- ENDIF plugins.url -->
					</li>
					<!-- ENDIF plugins.installed -->
					<!-- END plugins -->
				</ul>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-code-fork"></i> Download Plugins</div>
			<div class="panel-body">
				<ul>
					<!-- BEGIN plugins -->
					<!-- IF !plugins.installed -->
					<li data-plugin-id="{plugins.id}" class="clearfix">
						<div class="pull-right">
							<button data-action="toggleInstall" class="btn btn-success"><i class="fa fa-download"></i> Install</button>
						</div>

						<h2><strong>{plugins.name}</strong></h2>

						<!-- IF plugins.description -->
						<p>{plugins.description}</p>
						<!-- ENDIF plugins.description -->
						<!-- IF plugins.url -->
						<p>For more information: <a href="{plugins.url}">{plugins.url}</a></p>
						<!-- ENDIF plugins.url -->
					</li>
					<!-- ENDIF !plugins.installed -->
					<!-- END plugins -->
				</ul>
			</div>
		</div>
	</div>

	<div class="col-lg-3">
		<div class="panel panel-default">
			<div class="panel-heading">Plugin Search</div>
			<div class="panel-body">
				<input class="form-control" type="text" id="plugin-search" placeholder="Search for plugin..."/>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">Interested in writing plugins for NodeBB?</div>
			<div class="panel-body">
				<p>
					Full documentation regarding plugin authoring can be found in the <a target="_blank" href="https://docs.nodebb.org/en/latest/plugins/create.html">NodeBB Wiki</a>.
				</p>
			</div>
		</div>
	</div>
</div>