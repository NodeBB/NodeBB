

	</div><!--END container -->

	<div id="upload-picture-modal" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="Upload Picture" aria-hidden="true">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
					<h3 id="myModalLabel">[[user:upload_picture]]</h3>
				</div>
				<div class="modal-body">
					<form id="uploadForm" action="" method="post" enctype="multipart/form-data">
						<div class="form-group">
							<label for="userPhoto">[[user:upload_a_picture]]</label>
							<input type="file" id="userPhotoInput"  name="userPhoto">
							<p class="help-block">[[user:image_spec]] <span id="file-size-block" class="hide"> ([[user:max]] <span id="upload-file-size"></span> kbs.)</span></p>
						</div>
						<input id="imageUploadCsrf" type="hidden" name="_csrf" value="" />
						<input type="hidden" id="params" name="params">
					</form>

					<div id="upload-progress-box" class="progress progress-striped">
						<div id="upload-progress-bar" class="progress-bar progress-bar-success" role="progressbar" aria-valuenow="0" aria-valuemin="0">
							<span class="sr-only"> [[footer:success]]</span>
						</div>
					</div>

					<div id="alert-status" class="alert alert-info hide"></div>
					<div id="alert-success" class="alert alert-success hide"></div>
					<div id="alert-error" class="alert alert-danger hide"></div>
				</div>
				<div class="modal-footer">
					<button class="btn btn-default" data-dismiss="modal" aria-hidden="true">Close</button>
					<button id="pictureUploadSubmitBtn" class="btn btn-primary">[[user:upload_picture]]</button>
				</div>
			</div><!-- /.modal-content -->
		</div><!-- /.modal-dialog -->
	</div><!-- /.modal -->

	<div id="alert_window"></div>


	<footer id="footer" class="container footer hide">
		{footerHTML}
		<div class="copyright">
			Copyright &copy; 2014 <a target="_blank" href="https://www.nodebb.com">NodeBB Forums</a> | <a target="_blank" href="//github.com/designcreateplay/NodeBB/graphs/contributors">Contributors</a>
		</div>
	</footer>

	<script>
		require(['forum/footer']);
	</script>

</body>
</html>
