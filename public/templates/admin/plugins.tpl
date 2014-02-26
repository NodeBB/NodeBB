<h1><i class="fa fa-code-fork"></i> Plugins</h1>

<div class="alert alert-warning">
	<p>
		<strong>Interested in writing plugins for NodeBB?</strong>
	</p>
	<p>
		Full documentation regarding plugin authoring can be found in the <a target="_blank" href="https://github.com/designcreateplay/NodeBB/wiki/Writing-Plugins-for-NodeBB">NodeBB Wiki</a>.
	</p>
</div>

<ul class="plugins">
	<!-- BEGIN plugins -->
	<li data-plugin-id="{plugins.id}">
		<h2><strong>{plugins.name}</strong></h2>
		<div class="pull-right">
			<button data-action="toggleActive" class="btn <!-- IF plugins.active -->btn-warning<!-- ELSE -->btn-success<!-- ENDIF plugins.active -->">{plugins.activeText}</button>
		</div>
		<p>{plugins.description}</p>
		<p>For more information: <a href="{plugins.url}">{plugins.url}</a></p>
	</li>
	<!-- END plugins -->
</ul>


