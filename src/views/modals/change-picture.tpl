<div class="row gy-2">
	<div class="col-12 col-sm-8 col-md-6">
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
	<div class="col-12 col-sm-4 col-md-6">
		<div class="list-group">
			{{{ if allowProfileImageUploads }}}
			<button type="button" class="list-group-item" data-action="upload">
				[[user:upload-new-picture]]
			</button>
			{{{ end }}}
			<button type="button" class="list-group-item" data-action="upload-url">
				[[user:upload-new-picture-from-url]]
			</button>
			{{{ if uploaded }}}
			<button type="button" class="list-group-item" data-action="remove-uploaded">
				[[user:remove-uploaded-picture]]
			</button>
			{{{ end }}}
		</div>
	</div>
</div>

<hr />

<h4>[[user:avatar-background-colour]]</h4>
<div class="d-flex gap-2">
	<a href="#" class="lh-1 p-1" data-bg-color="transparent"><i class="fa-solid fa-2x fa-ban text-secondary"></i></a>
	{{{ each iconBackgrounds }}}
	<a href="#" class="lh-1 p-1" data-bg-color="{@value}" style="color: {@value};"><i class="fa-solid fa-2x fa-circle"></i></a>
{{{ end }}}
</div>