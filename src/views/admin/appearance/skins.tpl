<!-- IMPORT admin/appearance/header.tpl -->

<div id="skins" class="row">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading">Bootswatch Themes</div>
			<div class="panel-body">
				<p>
					NodeBB's skins are powered by Bootswatch, a repository containing themes built with Bootstrap as a base theme. Currently, the Vanilla theme is best optimized for use with Bootswatch.
				</p>
				<ul class="directory" id="bootstrap_themes">
					<li><i class="fa fa-refresh fa-spin"></i> Loading Themes</li>
				</ul>
			</div>
		</div>
	</div>
	<div class="col-lg-3">
		<div class="panel panel-default">
			<div class="panel-heading">Revert to Default</div>
			<div class="panel-body">
				<p>This will remove any custom Bootswatch skin applied to your NodeBB, and restore the base theme.</p>
				<button class="btn btn-warning btn-md" id="revert_theme">Revert to Default</button>
			</div>
		</div>
	</div>
</div>

<!-- IMPORT admin/appearance/footer.tpl -->