
		</div>
	</div>

	<div id="upload-picture-modal" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="Upload Picture" aria-hidden="true">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
					<h3 id="myModalLabel">Upload Picture</h3>
				</div>
				<div class="modal-body">
					<form id="uploadForm" action="" method="post" enctype="multipart/form-data">
						<div class="form-group">
							<label for="userPhoto">Upload a picture</label>
							<input type="file" id="userPhotoInput"  name="userPhoto">
							<p class="help-block"></p>
						</div>
						<input type="hidden" id="params" name="params">
						<input type="hidden" id="csrfToken" name="_csrf" />
					</form>

					<div id="upload-progress-box" class="progress progress-striped">
						<div id="upload-progress-bar" class="progress-bar progress-bar-success" role="progressbar" aria-valuenow="0" aria-valuemin="0">
							<span class="sr-only"> success</span>
						</div>
					</div>

					<div id="alert-status" class="alert alert-info hide"></div>
					<div id="alert-success" class="alert alert-success hide"></div>
					<div id="alert-error" class="alert alert-danger hide"></div>
				</div>
				<div class="modal-footer">
					<button class="btn btn-default" data-dismiss="modal" aria-hidden="true">Close</button>
					<button id="pictureUploadSubmitBtn" class="btn btn-primary">Upload Picture</button>
				</div>
			</div><!-- /.modal-content -->
		</div><!-- /.modal-dialog -->
	</div><!-- /.modal -->

	<div class="alert-window alert-left-top"></div>
	<div class="alert-window alert-left-bottom"></div>
	<div class="alert-window alert-right-top"></div>
	<div class="alert-window alert-right-bottom"></div>

	<div id="footer" class="container" style="padding-top: 50px; display:none;">
		<footer class="footer">Copyright &copy; 2014 <a target="_blank" href="http://www.nodebb.com">NodeBB</a> by <a target="_blank" href="https://github.com/psychobunny">psychobunny</a>, <a href="https://github.com/julianlam" target="_blank">julianlam</a>, <a href="https://github.com/barisusakli" target="_blank">barisusakli</a> from <a target="_blank" href="http://www.designcreateplay.com">designcreateplay</a></footer>
	</div>

<script type="text/javascript">
	require(['forum/admin/footer']);
</script>

</body>
</html>