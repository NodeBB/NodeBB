<div class="row gy-2">
	<div class="col-12 col-sm-8 col-md-6">
		<div class="d-flex flex-column gap-2">
			{{{ each pictures }}}
			<div class="d-flex align-items-center gap-3">
				<button component="profile/picture/button" type="button" class="btn btn-ghost border d-flex p-3 flex-grow-1 {{{ if ./selected }}}active{{{ end }}}" data-type="{./type}" data-url="{./picture}">
					<div class="flex-shrink-0">
						{buildAvatar(pictures, "48px", true)}
					</div>
					<div class="flex-grow-1 ms-3 align-self-center fs-5 text-start">
						{./username}
					</div>
				</button>
				<button class="btn btn-sm btn-ghost border {{{ if (./type != "uploaded") }}}invisible{{{ end }}}" data-action="remove-uploaded" data-url="{./picture}"><i class="text-danger fa-solid fa-trash-can"></i></button>
			</div>
			{{{ end }}}
		</div>
	</div>
	<div class="col-12 col-sm-4 col-md-6">
		<div class="d-flex flex-column gap-2">
			<h5>[[user:avatar-background-colour]]</h5>
			<div class="d-flex gap-2 flex-wrap">
				<a href="#" class="lh-1 p-1" data-bg-color="transparent"><i class="fa-solid fa-2x fa-ban text-secondary"></i></a>
				{{{ each iconBackgrounds }}}
				<a href="#" class="lh-1 p-1 {{{ if ./selected }}}selected{{{ end }}}" data-bg-color="{./color}" style="color: {./color};"><i class="fa-solid fa-2x fa-circle"></i></a>
				{{{ end }}}
			</div>
			<hr/>
			{{{ if allowProfileImageUploads }}}
			<button type="button" class="btn btn-ghost border" data-action="upload">
				[[user:upload-new-picture]]
			</button>
			{{{ end }}}
			<button type="button" class="btn btn-ghost border" data-action="upload-url">
				[[user:upload-new-picture-from-url]]
			</button>
		</div>
	</div>
</div>