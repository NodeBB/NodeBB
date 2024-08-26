<div id="crop-picture-modal" class="modal" tabindex="-1" role="dialog" aria-labelledby="crop-picture" aria-hidden="true">
	<div class="modal-dialog">
		<div class="modal-content">
			<div class="modal-header">
				<h3 id="crop-picture">[[user:crop-picture]]</h3>
				<button type="button" class="btn-close" data-bs-dismiss="modal" aria-hidden="true"></button>
			</div>
			<div class="modal-body">
				<div id="upload-progress-box" class="progress hide">
					<div id="upload-progress-bar" class="progress-bar progress-bar-striped active" role="progressbar" aria-valuenow="0" aria-valuemin="0">
					</div>
				</div>

				<div class="cropper">
					<img id="cropped-image" class="mw-100" crossorigin="anonymous" src="{url}" alt="">
				</div>

				<hr />

				<div class="btn-group">
					<button class="btn btn-primary rotate" data-degrees="-45"><i class="fa fa-rotate-left"></i></button>
					<button class="btn btn-primary rotate" data-degrees="45"><i class="fa fa-rotate-right"></i></button>
				</div>
				<div class="btn-group">
					<button class="btn btn-primary flip" data-option="-1" data-method="scaleX"><i class="fa fa-arrows-h"></i></button>
					<button class="btn btn-primary flip" data-option="-1" data-method="scaleY"><i class="fa fa-arrows-v"></i></button>
				</div>
				<div class="btn-group">
					<button class="btn btn-primary reset"><i class="fa fa-refresh"></i></button>
				</div>
			</div>
			<div class="modal-footer">
				<button class="btn btn-outline-secondary" data-bs-dismiss="modal" aria-hidden="true">Close</button>
				<button class="btn btn-primary upload-btn {{{ if !allowSkippingCrop }}}hidden{{{ end }}}">[[user:upload-picture]]</button>
				<button class="btn btn-primary crop-btn">[[user:upload-cropped-picture]]</button>
			</div>
		</div>
	</div>
</div>
