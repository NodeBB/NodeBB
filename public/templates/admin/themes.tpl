<h1><i class="fa fa-th"></i> Themes</h1>
<hr />

<div class="themes">
	<ul class="nav nav-tabs">
		<li class="active"><a href="#" data-target="#themes" data-toggle="tab">Themes</a></li>
		<li><a href="#" data-target="#customise" data-toggle="tab">Customise</a></li>
		<li><a href="#" data-target="#widgets" data-toggle="tab">Widgets</a></li>
	</ul>

	<div class="tab-content">
		<div class="tab-pane" id="themes">
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
		<div class="tab-pane active" id="widgets">
			<h3>Widgets</h3>

			<div class="row">
				<div class="col-xs-6">
					<h4>Available Widgets</h4>
					<div class="well">
						<div data-widget="html" class="panel panel-default pointer">
							<div class="panel-heading">
								<strong>HTML</strong> <small>Any text, html, or embedded script.</small>
							</div>
							<div class="panel-body hidden">
								<form>
									<textarea class="form-control" rows="6" name="html" placeholder="Enter HTML"></textarea>
								</form>
							</div>
						</div>
						<div data-widget="markdown" class="panel panel-default pointer">
							<div class="panel-heading">
								<strong>Markdown</strong> <small>Markdown formatted text</small>
							</div>
							<div class="panel-body hidden">
								<form>
									<textarea class="form-control" rows="6" name="markdown" placeholder="Enter Markdown"></textarea>
								</form>
							</div>
						</div>
						<!-- BEGIN widgets -->

						<!-- END widgets -->
					</div>
				</div>

				<div class="col-xs-6">
					<!-- BEGIN areas -->
					<div class="area">
						<h4>{areas.name} <small>{areas.template} / {areas.location}</small> <button data-template="{areas.template}" data-location="{areas.location}" class="btn btn-success btn-xs pull-right">Save</button></h4>
						<div class="well widget-area">

						</div>
					</div>
					<!-- END areas -->
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