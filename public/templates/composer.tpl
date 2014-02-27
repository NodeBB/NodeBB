<div class="composer">

	<style>
			/* todo: move this to base theme */
			.topic-thumb-container { width: 95%; margin-top: 5px; background: rgb(255, 255, 255); background: rgba(255, 255, 255, 0.6); padding: 10px; }
			.topic-thumb-btn { cursor: hand; cursor: pointer; }
			.topic-thumb-toggle-btn { margin: -25px 3% 0 0; }
			.topic-thumb-preview { width: auto; height: auto; max-width: 100px; max-height: 100px }
			.topic-thumb-ctrl.form-group { display: inline-block; vertical-align: -50% !important; }
	</style>

	<div class="composer-container">
		<input class="title form-control" type="text" tabIndex="1" placeholder="[[topic:composer.title_placeholder]]" />

		<!-- IF allowTopicsThumbnail -->
		<i class="fa fa-picture-o pull-right topic-thumb-btn topic-thumb-toggle-btn hide" title="[[topic:composer.thumb_title]]"></i>
		<div class="topic-thumb-container center-block hide">
			<form id="thumbForm" method="post" class="topic-thumb-form form-inline" enctype="multipart/form-data">
				<img class="topic-thumb-preview"></img>
				<div class="form-group">
					<label for="topic-thumb-url">[[topic:composer.thumb_url_label]]</label>
					<input type="text" id="topic-thumb-url" class="form-control" placeholder="[[topic:composer.thumb_url_placeholder]]" />
				</div>
				<div class="form-group">
					<!-- todo: drag and drop? -->
					<label for="topic-thumb-file">[[topic:composer.thumb_file_label]]</label>
					<input type="file" id="topic-thumb-file" class="form-control" />
				</div>
				<div class="form-group topic-thumb-ctrl">
					<i class="fa fa-spinner fa-spin hide topic-thumb-spinner" title="[[topic:composer.uploading]]"></i>
					<i class="fa fa-times topic-thumb-btn hide topic-thumb-clear-btn" title="[[topic:composer.thumb_remove]]"></i>
					<input id="thumbUploadCsrf" type="hidden" name="_csrf">
				</div>
			</form>
		</div>
        <!--  ENDIF allowTopicsThumbnail -->

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

				<form id="fileForm" method="post" enctype="multipart/form-data">
					<input type="file" id="files" name="files[]" multiple class="hide"/>
					<input id="postUploadCsrf" type="hidden" name="_csrf">
				</form>
			</div>
		</div>

		<ul class="nav nav-tabs">
			<li class="active"><a data-pane=".tab-write" data-toggle="tab">[[topic:composer.write]]</a></li>
			<li><a data-pane=".tab-preview" data-toggle="tab">[[topic:composer.preview]]</a></li>
			<li class="hidden"><a data-pane=".tab-help" data-toggle="tab">[[topic:composer.help]]</a></li>
			<li class="btn-group pull-right action-bar">
				<button class="btn btn-default" data-action="discard" tabIndex="5"><i class="fa fa-times"></i> [[topic:composer.discard]]</button>
				<button data-action="post" class="btn btn-default btn-primary" tabIndex="3"><i class="fa fa-check"></i> [[topic:composer.submit]]</button>
			</li>
		</ul>

		<div class="tab-content">
			<div class="tab-pane active tab-write">
				<textarea class="write" tabIndex="2"></textarea>
			</div>
			<div class="tab-pane tab-preview">
				<div class="preview well"></div>
			</div>
			<div class="tab-pane tab-help">
				<div class="help well"></div>
			</div>
		</div>

		<div class="imagedrop"><div>[[topic:composer.drag_and_drop_images]]</div></div>

		<div class="text-center instructions">
			<span>
				<span class="upload-instructions hide"><small>[[topic:composer.upload_instructions]]</small></span>
			</span>

		</div>

		<div class="resizer"><div class="trigger text-center"><i class="fa fa-chevron-up"></i></div></div>
	</div>
</div>