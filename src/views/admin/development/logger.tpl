<!-- IMPORT admin/partials/settings/header.tpl -->
<div class="row logger">
	<div class="col-lg-12">
		<div class="panel panel-default">
			<div class="panel-heading">[[admin/development/logger:logger-settings]]</div>
			<div class="panel-body">
				<p>
					[[admin/development/logger:description]]
				</p>
				<br/>
				<p>
					[[admin/development/logger:explanation]]
				</p>
				<br/>

				<form>

					<label>
						<input type="checkbox" data-field="loggerStatus"> <strong>[[admin/development/logger:enable-http]]</strong>
					</label>
					<br/>
					<br/>

					<label>
						<input type="checkbox" data-field="loggerIOStatus"> <strong>[[admin/development/logger:enable-socket]]</strong>
					</label>
					<br/>
					<br/>

					<label for="loggerPath">[[admin/development/logger:file-path]]</label>
					<input id="loggerPath" class="form-control" type="text" placeholder="[[admin/development/logger:file-path-placeholder]]" data-field="loggerPath" />
				</form>
			</div>
		</div>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->
