<div id="widgets">
	<div class="col-md-7">
		<div class="panel panel-default">
			<div class="panel-heading">Widget Areas</div>
			<div class="panel-body">
				<div class="row">
					<ul class="nav nav-pills">
					<!-- BEGIN templates -->
						<li class="<!-- IF @first -->active<!-- ENDIF @first -->"><a href="#" data-template="{templates.template}" data-toggle="pill">{templates.template}</a></li>
					<!-- END templates -->
					</ul>

					<div class="tab-content">
					<!-- BEGIN templates -->
						<div class="tab-pane <!-- IF @first -->active<!-- ENDIF @first -->" data-template="{templates.template}">
						<!-- BEGIN areas -->
							<div class="area" data-template="{templates.template}" data-location="{templates.areas.location}">
								<h4>{templates.areas.name} <small>{templates.template} / {templates.areas.location}</small></h4>
								<div class="well widget-area">

								</div>
							</div>
						<!-- END areas -->
						</div>
					<!-- END templates -->
					</div>

					<button class="btn btn-success save pull-right">Save</button>
				</div>
			</div>
		</div>
	</div>

	<div class="col-md-5">
		<div class="panel panel-default">
			<div class="panel-heading">Available Widgets</div>
			<div class="panel-body">
				<div class="available-widgets">
					<p>Drag and drop widgets into templates</p>
					<!-- IF !widgets.length -->
					<div class="alert alert-info">No widgets found! Activate the essential widgets plugin in the <a href="/admin/plugins">plugins</a> control panel.</div>
					<!-- ENDIF !widgets.length -->
					<div class="row">
						<!-- BEGIN widgets -->
						<div class="col-lg-3 col-md-12">
							<div data-widget="{widgets.widget}" class="panel widget-panel panel-default pointer">
								<div class="panel-heading">
									<strong>{widgets.name}</strong>
									<small><br />{widgets.description}</small>
								</div>
								<div class="panel-body hidden">
									<form>
										{widgets.content}
									</form>
								</div>
							</div>
						</div>
						<!-- END widgets -->
					</div>
				</div>
			</div>
		</div>
		<div class="panel panel-default">
			<div class="panel-heading">Available Containers</div>
			<div class="panel-body">
				<div class="available-widgets">
					<p>Drag and drop on top of any active widget</p>
					<div class="available-containers">
						<h4>Available Containers <small>Drag and drop on top of any widget</small></h4>
						<div class="containers">
							<div class="pointer" style="padding: 20px; border: 1px dotted #dedede; margin-bottom: 20px;" data-container-html=" ">
								None
							</div>
							<div class="well pointer" data-container-html='<div class="well">{body}</div>'>
								Well
							</div>
							<div class="jumbotron pointer" data-container-html='<div class="jumbotron">{body}</div>'>
								Jumbotron
							</div>
							<div class="panel" data-container-html='<div class="panel"><div class="panel-body">{body}</div></div>'>
								<div class="panel-body pointer">
									Panel
								</div>
							</div>
							<div class="panel panel-default pointer" data-container-html='<div class="panel panel-default"><div class="panel-heading">{title}</div><div class="panel-body">{body}</div></div>'>
								<div class="panel-heading">
									Panel Header
									<div class="pull-right color-selector">
										<button data-class="panel-default" class="btn btn-xs">&nbsp;&nbsp;</button>
										<button data-class="panel-primary" class="btn btn-xs btn-primary">&nbsp;&nbsp;</button>
										<button data-class="panel-success" class="btn btn-xs btn-success">&nbsp;&nbsp;</button>
										<button data-class="panel-info" class="btn btn-xs btn-info">&nbsp;&nbsp;</button>
										<button data-class="panel-warning" class="btn btn-xs btn-warning">&nbsp;&nbsp;</button>
										<button data-class="panel-danger" class="btn btn-xs btn-danger">&nbsp;&nbsp;</button>
									</div>
								</div>
								<div class="panel-body">
									Panel Body
								</div>
							</div>

							<div class="alert alert-info pointer" data-container-html='<div class="alert alert-info">{body}</div>'>
								Alert
								<div class="pull-right color-selector">
									<button data-class="alert-success" class="btn btn-xs btn-success">&nbsp;&nbsp;</button>
									<button data-class="alert-info" class="btn btn-xs btn-info">&nbsp;&nbsp;</button>
									<button data-class="alert-warning" class="btn btn-xs btn-warning">&nbsp;&nbsp;</button>
									<button data-class="alert-danger" class="btn btn-xs btn-danger">&nbsp;&nbsp;</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>