<h1><i class="fa fa-th"></i> Themes</h1>
<hr />

<div class="themes">
	<ul class="nav nav-tabs">
		<li class="active"><a href="#" data-target="#themes" data-toggle="tab">Themes</a></li>
		<li><a href="#" data-target="#customise" data-toggle="tab">Customise</a></li>
		<li><a href="#" data-target="#widgets" data-toggle="tab">Widgets</a></li>
	</ul>

	<div class="tab-content">
		<div class="tab-pane active" id="themes">
			<h3>Installed Themes</h3>
			<p>
				The following themes are currently installed in this NodeBB instance.
			</p>
			<ul class="directory" id="installed_themes">
				<li><i class="fa fa-refresh fa-spin"></i> Checking for installed themes...</li>
			</ul>

			<h3>Bootswatch Themes</h3>
			<p>
				NodeBB Themes are powered by Bootswatch, a repository containing themes built
				with Bootstrap as a base theme.
			</p>
			<ul class="directory" id="bootstrap_themes">
				<li><i class="fa fa-refresh fa-spin"></i> Loading Themes</li>
			</ul>

			<h3>Revert to Default</h3>
			<p class="alert">
				<button class="btn btn-warning" id="revert_theme">Revert</button> This will remove any custom theme applied to your NodeBB, and restore the base theme.
			</p>
		</div>
		<div class="tab-pane" id="customise">
			<h3>Custom CSS</h3>
			<p>
				You may also opt to enter your own CSS declarations here, which will be applied after all other styles.
			</p>
			<textarea class="well" data-field="customCSS" placeholder="Enter your custom CSS here..."></textarea>

			<form class="form">
				<div class="form-group">
					<label for="useCustomCSS">
						Use Custom CSS?
						<input id="useCustomCSS" type="checkbox" data-field="useCustomCSS" />
					</label>
				</div>
			</form>

			<button class="btn btn-primary" id="save">Save</button>
		</div>
		<div class="tab-pane" id="widgets">
			<h3>Widgets</h3>

			<div class="row">
				<div class="col-xs-6 pull-right">
					<!-- BEGIN areas -->
					<div class="area">
						<h4>{areas.name} <small>{areas.template} / {areas.location}</small> <button data-template="{areas.template}" data-location="{areas.location}" class="btn btn-success btn-xs pull-right">Save</button></h4>
						<div class="well widget-area">

						</div>
					</div>
					<!-- END areas -->
				</div>
				<div class="col-xs-6 pull-left">
					<div class="available-widgets">
						<h4>Available Widgets <small>Drag and drop widgets into templates</small></h4>
						<div>
							<!-- BEGIN widgets -->
							<div data-widget="{widgets.widget}" class="panel panel-default pointer">
								<div class="panel-heading">
									<strong>{widgets.name}</strong> <small>{widgets.description}</small>
								</div>
								<div class="panel-body hidden">
									<form>
										{widgets.content}
									</form>
								</div>
							</div>
							<!-- END widgets -->
						</div>
					</div>
					<hr />
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

<script>
	var bootswatchListener = function(data) {
		require(['forum/admin/themes'], function(t) {
			t.render(data);
		});
	}
</script>