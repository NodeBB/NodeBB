<div class="modal" tabindex="-1" role="dialog" aria-labelledby="[[flags:modal-title]]" aria-hidden="true">
	<div class="modal-dialog modal-lg">
		<div class="modal-content">
			<div class="modal-header">
				<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
				<h4 class="modal-title">
					[[flags:modal-title]]
				</h4>
			</div>
			<div class="modal-body">
				<p class="lead">
					[[flags:modal-body, {type}, {id}]]
				</p>
				<div>
					<div class="radio">
						<label for="flag-reason-spam">
							<input type="radio" name="flag-reason" id="flag-reason-spam" value="[[flags:modal-reason-spam]]">
							[[flags:modal-reason-spam]]
						</label>
					</div>

					<div class="radio">
						<label for="flag-reason-offensive">
							<input type="radio" name="flag-reason" id="flag-reason-offensive" value="[[flags:modal-reason-offensive]]">
							[[flags:modal-reason-offensive]]
						</label>
					</div>

					<div class="radio">
						<label for="flag-reason-other">
							<input type="radio" name="flag-reason" id="flag-reason-other" value="[[flags:modal-reason-other]]">
							[[flags:modal-reason-other]]
						</label>
					</div>
				</div>
				<div class="form-group">
					<textarea class="form-control" id="flag-reason-custom" placeholder="[[flags:modal-reason-custom]]" disabled="disabled"></textarea>
				</div>

				<button type="button" class="btn btn-primary pull-right" id="flag-post-commit" disabled>[[flags:modal-submit]]</button>
				<div class="clear"></div>
			</div>
		</div>
	</div>
</div>