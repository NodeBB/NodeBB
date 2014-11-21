	<div id="new-category-modal" class="modal" tabindex="-1" role="dialog" aria-labelledby="Add New Modal" aria-hidden="true">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
					<h3>Create New Category</h3>
				</div>
				<div class="modal-body">
					<div>
						<form class='form-horizontal'>
							<div class="control-group">
								<label class="control-label" for="inputName">Name</label>
								<div class="controls">
									<input class="form-control" type="text" id="inputName" placeholder="Name" value="">
								</div>
							</div>

							<div class="control-group">
								<label class="control-label" for="inputDescription">Description</label>
								<div class="controls">
									<input class="form-control" type="text" id="inputDescription" placeholder="Description" value="">
								</div>
							</div>

							<div class="control-group">
								<label class="control-label" for="inputIcon">Icon</label>
								<div class="controls">
									<div class="icon">
										<i data-name="icon" value="fa-pencil" class="fa fa-pencil fa-2x"></i>
									</div>
								</div>
							</div>
						</form>
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" id="create-category-btn" href="#" class="btn btn-primary btn-lg btn-block">Create</button>
				</div>
			</div><!-- /.modal-content -->
		</div><!-- /.modal-dialog -->
	</div><!-- /.modal -->