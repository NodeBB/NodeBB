<div class="composer">
	<div class="composer-container">
		<input class="title" type="text" tabIndex="1" placeholder="Enter your topic title here..." />
		<div class="btn-toolbar formatting-bar">
			<div class="btn-group">
				<span class="btn btn-link" tabindex="-1"><i class="fa fa-bold"></i></span>
				<span class="btn btn-link" tabindex="-1"><i class="fa fa-italic"></i></span>
				<span class="btn btn-link" tabindex="-1"><i class="fa fa-list"></i></span>
				<span class="btn btn-link" tabindex="-1"><i class="fa fa-link"></i></span>
				<span class="btn btn-link img-upload-btn hide" tabindex="-1">
					<i class="fa fa-picture-o"></i>
				</span>
				<span class="btn btn-link file-upload-btn hide" tabindex="-1">
					<i class="fa fa-upload"></i>
				</span>
				<form id="fileForm">
						<input type="file" id="files" name="files[]" multiple class="hide"/>
				</form>
			</div>
			<!-- <div class="btn btn-link pull-right">Preview</div> -->
		</div>
		<textarea tabIndex="2"></textarea>
		<div class="preview"></div>
		<div class="imagedrop"><div>Drag and Drop Images Here</div></div>
		<div class="text-center upload-instructions hide">
			<small>Upload images by dragging & dropping them</small>
		</div>
		<div class="btn-toolbar action-bar">
			<div class="btn-group pull-right">
				<button class="btn btn-default" data-action="discard" tabIndex="5"><i class="fa fa-times"></i> Discard</button>
				<button data-action="post" class="btn btn-default" tabIndex="3"><i class="fa fa-check"></i> Submit</button>
			</div>
		</div>
		<div class="resizer"><div class="trigger"><i class="fa fa-chevron-left"></i></div></div>
	</div>
</div>