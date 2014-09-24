<h1><i class="fa fa-code-fork"></i> Plugins</h1>

<div class="alert alert-warning">
	<p>
		<strong>Interested in writing plugins for NodeBB?</strong>
	</p>
	<p>
		Full documentation regarding plugin authoring can be found in the <a target="_blank" href="https://docs.nodebb.org/en/latest/plugins/create.html">NodeBB Wiki</a>.
	</p>
</div>

<input class="form-control" type="text" id="plugin-search" placeholder="Search plugins"/>
<br/>

<ul class="plugins">
	<!-- BEGIN plugins -->
	<li data-plugin-id="{plugins.id}" class="clearfix">
		<div class="pull-right">

			<button data-action="toggleActive" class="btn <!-- IF plugins.active --> btn-warning<!-- ELSE --> btn-success<!-- ENDIF plugins.active --><!-- IF !plugins.installed --> hide<!-- ENDIF !plugins.installed -->"><i class="fa fa-power-off"></i> <!-- IF plugins.active -->Deactivate<!-- ELSE -->Activate<!-- ENDIF plugins.active --></button>


			<!-- IF plugins.installed -->
			<button data-action="toggleInstall" class="btn btn-danger"><i class="fa fa-trash-o"></i> Uninstall</button>
			<!-- ELSE -->
			<button data-action="toggleInstall" class="btn btn-success"><i class="fa fa-download"></i> Install</button>
			<!-- ENDIF plugins.installed -->
		</div>

		<h2><strong>{plugins.name}</strong></h2>

		<!-- IF plugins.description -->
		<p>{plugins.description}</p>
		<!-- ENDIF plugins.description -->
		<!-- IF plugins.url -->
		<p>For more information: <a href="{plugins.url}">{plugins.url}</a></p>
		<!-- ENDIF plugins.url -->
	</li>
	<!-- END plugins -->
</ul>


