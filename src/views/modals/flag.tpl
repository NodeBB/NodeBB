<div class="modal" tabindex="-1" role="dialog" aria-label="{{tx("flags:modal-title")}}">
	<div class="modal-dialog modal-lg">
		<div class="modal-content">
			<div class="modal-header">
				<h5 class="modal-title">{{tx("flags:modal-title")}}</h5>
				<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="{{tx("global:buttons.close")}}"></button>
			</div>
			<div class="modal-body">
				<p class="lead">
					{{tx("flags:modal-body", type, id)}}
				</p>
				<div>
					<div class="radio mb-2">
						<label for="flag-reason-spam">
							<input type="radio" name="flag-reason" id="flag-reason-spam" value="{{tx("flags:modal-reason-spam")}}">
							{{tx("flags:modal-reason-spam")}}
						</label>
					</div>

					<div class="radio mb-2">
						<label for="flag-reason-offensive">
							<input type="radio" name="flag-reason" id="flag-reason-offensive" value="{{tx("flags:modal-reason-offensive")}}">
							{{tx("flags:modal-reason-offensive")}}
						</label>
					</div>

					<div class="radio mb-2">
						<label for="flag-reason-other">
							<input type="radio" name="flag-reason" id="flag-reason-other" value="{{tx("flags:modal-reason-other")}}">
							{{tx("flags:modal-reason-other")}}
						</label>
					</div>
				</div>
				<div class="mb-2">
					<textarea class="form-control" id="flag-reason-custom" placeholder="{{tx("flags:modal-reason-custom")}}" disabled="disabled"></textarea>
				</div>
				{{{ if remote }}}
				<div class="form-check form-switch mb-3">
					<input class="form-check-input" type="checkbox" name="flag-notify-remote" checked="checked">
					<label class="form-check-label text-sm" for="flag-notify-remote">
						{{tx("flags:modal-notify-remote", remote)}}
					</label>
				</div>
				{{{ end }}}

				<button type="button" class="btn btn-primary" id="flag-post-commit" disabled>{{tx("flags:modal-submit")}}</button>
			</div>
		</div>
	</div>
</div>