<div id="widgets" class="row">
	<div class="col-md-7" id="active-widgets">
		<ul class="nav nav-pills">
		<!-- BEGIN templates -->
			<li class="<!-- IF @first -->active<!-- ENDIF @first -->"><a href="#" data-template="{../template}" data-toggle="pill">{../template}</a></li>
		<!-- END templates -->
		</ul>

		<div class="row">
			<div class="col-xs-12">
				<div class="tab-content">
				<!-- BEGIN templates -->
					<div class="tab-pane <!-- IF @first -->active<!-- ENDIF @first -->" data-template="{../template}">
					<!-- BEGIN areas -->
						<div class="area" data-template="{templates.template}" data-location="{../location}">
							<h4>{../name} <small>{templates.template} / {../location}</small></h4>
							<div class="well widget-area">

							</div>
						</div>
					<!-- END areas -->
					</div>
				<!-- END templates -->
				</div>
			</div>
		</div>
	</div>

	<div class="col-md-5">
		<div class="panel panel-default">
			<div class="panel-heading">Available Widgets</div>
			<div class="panel-body">
				<div class="available-widgets">
					<p>Select a widget from the dropdown menu and then drag and drop it into a template's widget area on the left.</p>
					<!-- IF !widgets.length -->
					<div class="alert alert-info">No widgets found! Activate the essential widgets plugin in the <a href="/admin/extend/plugins">plugins</a> control panel.</div>
					<!-- ENDIF !widgets.length -->
					<p>
						<select id="widget-selector" class="form-control">
							<!-- BEGIN widgets -->
							<option value="{widgets.widget}">{widgets.name}</option>
							<!-- END widgets -->
						</select>
					</p>
					<div class="row">
						<!-- BEGIN widgets -->
						<div class="col-xs-12">
							<div data-widget="{widgets.widget}" class="panel widget-panel panel-default pointer hide">
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
				<p>Drag and drop on top of any active widget</p>
				<div class="available-containers">
					<div class="containers">
						<div class="pointer" style="padding: 20px; border: 1px dotted #dedede; margin-bottom: 20px;" data-container-html=" ">
							None
						</div>
						<div class="well pointer" data-container-html='<div class="well">\{{body\}}</div>'>
							Well
						</div>
						<div class="jumbotron pointer" data-container-html='<div class="jumbotron">\{{body\}}</div>'>
							Jumbotron
						</div>
						<div class="panel" data-container-html='<div class="panel panel-default"><div class="panel-body">\{{body\}}</div></div>'>
							<div class="panel-body pointer">
								Panel
							</div>
						</div>
						<div class="panel panel-default pointer" data-container-html='<div class="panel panel-default"><div class="panel-heading"><h3 class="panel-title">\{{title\}}</h3></div><div class="panel-body">\{{body\}}</div></div>'>
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

						<div class="alert alert-info pointer" data-container-html='<div class="alert alert-info">\{{body\}}</div>'>
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

<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
	<i class="material-icons">save</i>
</button>