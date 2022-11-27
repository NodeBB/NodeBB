<div class="row">
	<div class="col-6 col-sm-8 col-md-6">
		<div class="list-group">
			{{{each pictures}}}
			<button type="button" class="list-group-item d-flex p-3" data-type="{pictures.type}">
				<div class="flex-shrink-0">
					{buildAvatar(pictures, "48px", true)}
				</div>
				<div class="flex-grow-1 ms-3 align-self-center fs-5 text-start">
					{pictures.username}
				</div>
			</button>
			{{{end}}}
		</div>
	</div>
	<div class="col-6 col-sm-4 col-md-6">
		<div class="list-group">
			<!-- IF allowProfileImageUploads -->
			<button type="button" class="list-group-item" data-action="upload">
				<span class="hidden-xs hidden-sm">
					[[user:upload_new_picture]]
				</span>
				<span class="visible-xs-inline visible-sm-inline">
					<i class="fa fa-plus"></i>
					<i class="fa fa-upload"></i>
				</span>
			</button>
			<!-- ENDIF allowProfileImageUploads -->
			<button type="button" class="list-group-item" data-action="upload-url">
				<span class="hidden-xs hidden-sm">
					[[user:upload_new_picture_from_url]]
				</span>
				<span class="visible-xs-inline visible-sm-inline">
					<i class="fa fa-plus"></i>
					<i class="fa fa-link"></i>
				</span>
			</button>
			<!-- IF uploaded -->
			<button type="button" class="list-group-item" data-action="remove-uploaded">
				<span class="hidden-xs hidden-sm">
					[[user:remove_uploaded_picture]]
				</span>
				<span class="visible-xs-inline visible-sm-inline">
					<i class="fa fa-picture-o"></i>
					<i class="fa fa-long-arrow-right"></i>
					<i class="fa fa-trash-o"></i>
				</span>
			</button>
			<!-- ENDIF uploaded -->
		</div>
	</div>
</div>

<hr />

<h4>[[user:avatar-background-colour]]</h4>

<label><input type="radio" name="icon:bgColor" value="transparent" /><span></span></label>
{{{ each iconBackgrounds }}}
<label><input type="radio" name="icon:bgColor" value="{@value}" /><span style="background-color: {@value};"></span></label>
{{{ end }}}