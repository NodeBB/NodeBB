<div class="tags">
	<!-- IF !tags.length -->
	<div class="alert alert-warning">
		<strong>Your forum does not have any topics with tags yet!</strong>
	</div>
	<!-- ENDIF !tags.length -->

	<input class="form-control" type="text" id="tag-search" placeholder="Search"/><br/>


	<div class="row">
		<div class="tag-list">
			<!-- BEGIN tags -->
			<div class="tag-row col-md-12" data-tag="{tags.value}">
				<div class="col-sm-5 col-xs-12">
					<a href="{relative_path}/tags/{tags.value}" data-value="{tags.value}"><span class="tag-item" data-tag="{tags.value}" style="<!-- IF tags.color -->color: {tags.color};<!-- ENDIF tags.color --><!-- IF tags.bgColor -->background-color: {tags.bgColor};<!-- ENDIF tags.bgColor -->">{tags.value}</span><span class="tag-topic-count">{tags.score}</span></a>
				</div>

				<div class="col-sm-3 col-xs-12">
					<div class="form-group">
						<label for="bgColor">Background Colour</label>
						<input id="bgColor" placeholder="#ffffff" data-name="bgColor" value="{tags.bgColor}" class="form-control category_bgColor" />
					</div>
				</div>
				<div class="col-sm-3 col-xs-12">
					<div class="form-group">
						<label for="color">Text Colour</label>
						<input id="color" placeholder="#a2a2a2" data-name="color" value="{tags.color}" class="form-control category_color" />
					</div>
				</div>
				<div class="col-sm-1 col-xs-12">
					<button class="btn btn-primary save">Save</button>
				</div>
			</div>
			<!-- END tags -->
		</div>
	</div>
</div>