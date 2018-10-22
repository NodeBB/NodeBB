<div class="hooks-list panel-group" id="accordion" role="tablist" aria-multiselectable="true">
	<!-- BEGIN hooks -->
	<div class="panel panel-default">
		<div class="panel-heading" role="tab">
		<div class="panel-title">
			<a role="button" data-toggle="collapse" data-parent="#accordion" data-target="#{hooks.index}" aria-expanded="true" aria-controls="{hooks.index}">
			{hooks.hookName}
			</a>
			<span class="pull-right">{hooks.count} hooks</span>
		</div>
		</div>
		<div id="{hooks.index}" class="panel-collapse collapse" role="tabpanel">
		<div class="panel-body clearfix">
			<!-- BEGIN hooks.methods -->
			<div class="clearfix">
				<strong>{hooks.methods.id}</strong>
				Priority: {hooks.methods.priority}

				<button class="btn btn-primary btn-sm pull-right" type="button" data-toggle="collapse" data-target="#{hooks.methods.index}" aria-expanded="false" aria-controls="{hooks.methods.index}">
					Show Code <i class="fa fa-eye"></i>
				</button>
			</div>
			<div class="collapse" id="{hooks.methods.index}">
				<pre>{hooks.methods.method}</pre>
			</div>
			<!-- END hooks.methods -->
		</div>
		</div>
	</div>
	<!-- END hooks -->
</div>