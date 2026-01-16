<div class="modal" tabindex="-1" role="dialog" aria-labelledby="upload-file" aria-hidden="true">
	<div class="modal-dialog">
		<div class="modal-content">
			<div class="modal-header">
				<h5 class="modal-title">{title}</h5>
				<button type="button" class="btn-close" data-bs-dismiss="modal" aria-hidden="true"></button>
			</div>
			<div class="modal-body">
				<form class="mb-3" id="uploadForm" action="" method="post" enctype="multipart/form-data">
					<div>
						{{{ if description }}}
						<label class="form-label" for="fileInput">{description}</label>
						{{{ end }}}
						<input type="file" id="fileInput" name="files[]" {{{ if accept }}}accept="{accept}"{{{ end }}}>
						{{{ if showHelp }}}
						<p class="form-text">
							{{{ if accept }}}
							[[global:allowed-file-types, {accept}]]
							{{{ end }}}

							{{{ if fileSize }}}<span id="file-size-block">([[uploads:maximum-file-size, {fileSize}]])</span>{{{ end }}}
						</p>
						{{{ end }}}
					</div>
					<input type="hidden" id="params" name="params" />
				</form>

				<div id="upload-progress-box" class="progress progress-striped hide mb-3">
					<div id="upload-progress-bar" class="progress-bar bg-success" role="progressbar" aria-valuenow="0" aria-valuemin="0">
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