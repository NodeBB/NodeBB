<div class="modal" tabindex="-1" role="dialog" aria-labelledby="upload-file" aria-hidden="true">
	<div class="modal-dialog">
		<div class="modal-content">
			<div class="modal-header">
				<h5 class="modal-title">{title}</h5>
				<button type="button" class="btn-close" data-bs-dismiss="modal" aria-hidden="true"></button>
			</div>
			<div class="modal-body">
				<form id="uploadForm" action="" method="post" enctype="multipart/form-data">
					<div class="form-group">
						<!-- IF description -->
						<label for="fileInput">{description}</label>
						<!-- ENDIF description -->
						<input type="file" id="fileInput" name="files[]" <!-- IF accept -->accept="{accept}"<!-- ENDIF accept -->>
						<!-- IF showHelp -->
						<p class="form-text">
							<!-- IF accept -->
							[[global:allowed-file-types, {accept}]]
							<!-- ENDIF accept -->

							<!-- IF fileSize --><span id="file-size-block">([[uploads:maximum-file-size, {fileSize}]])</span><!-- ENDIF fileSize -->
						</p>
						<!-- ENDIF showHelp -->
					</div>
					<input type="hidden" id="params" name="params" />
				</form>

				<div id="upload-progress-box" class="progress progress-striped hide">
					<div id="upload-progress-bar" class="progress-bar progress-bar-success" role="progressbar" aria-valuenow="0" aria-valuemin="0">
						<span class="sr-only"> [[success:success]]</span>
					</div>
				</div>

				<div id="alert-status" class="alert alert-info hide"></div>
				<div id="alert-success" class="alert alert-success hide"></div>
				<div id="alert-error" class="alert alert-danger hide"></div>
			</div>
			<div class="modal-footer">
				<button class="btn btn-outline-secondary" data-bs-dismiss="modal" aria-hidden="true">[[global:close]]</button>
				<button id="fileUploadSubmitBtn" class="btn btn-primary">{button}</button>
			</div>
		</div>
	</div>
</div>