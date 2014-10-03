<div class="tags">
	<!-- IF !tags.length -->
	<div class="alert alert-warning">
		<strong>Your forum does not have any topics with tags yet!</strong>
	</div>
	<!-- ENDIF !tags.length -->

	<div class="col-lg-9">
		<div class="panel panel-default tag-management">
			<div class="panel-heading">Tag Management</div>
			<div class="panel-body">
				<div class="row">
					<div class="tag-list">
						<!-- BEGIN tags -->
						<div class="tag-row" data-tag="{tags.value}">
							<div data-value="{tags.value}">
								<span class="tag-item" data-tag="{tags.value}" style="<!-- IF tags.color -->color: {tags.color};<!-- ENDIF tags.color --><!-- IF tags.bgColor -->background-color: {tags.bgColor};<!-- ENDIF tags.bgColor -->">{tags.value}</span><span class="tag-topic-count"><a href="{relative_path}/tags/{tags.value}" target="_blank">{tags.score}</a></span>
							</div>
							<div class="tag-modal hidden">
								<div class="form-group">
									<label for="bgColor">Background Colour</label>
									<input id="bgColor" placeholder="#ffffff" data-name="bgColor" value="{tags.bgColor}" class="form-control category_bgColor" />
								</div>
								<div class="form-group">
									<label for="color">Text Colour</label>
									<input id="color" placeholder="#a2a2a2" data-name="color" value="{tags.color}" class="form-control category_color" />
								</div>
							</div>
						</div>
						<!-- END tags -->
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="col-lg-3">
		<div class="panel panel-default">
			<div class="panel-heading">Modify Tag</div>
			<div class="panel-body">
				<p>Select tags via clicking and/or dragging, use shift to select multiple.</p>
				<button class="btn btn-primary btn-md" id="modify">Modify Selected Tags</button>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">Search for Tags</div>
			<div class="panel-body">
				<input class="form-control" type="text" id="tag-search" placeholder="Search..."/><br/>
			</div>
		</div>
	</div>
	
</div>