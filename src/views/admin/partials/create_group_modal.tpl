<div class="modal fade" id="create-modal">
	<div class="modal-dialog">
		<div class="modal-content">
			<div class="modal-header">
				<h4 class="modal-title">[[admin/manage/groups:create]]</h4>
				<button type="button" class="btn-close" data-bs-dismiss="modal" aria-hidden="true"></button>
			</div>
			<div class="modal-body">
				<div class="alert alert-danger hide" id="create-modal-error"></div>
				<form>
					<div class="mb-3">
						<label class="form-label" for="create-group-name">[[admin/manage/groups:name]]</label>
						<input type="text" class="form-control" id="create-group-name" placeholder="[[admin/manage/groups:name]]" />
					</div>
					<div class="mb-3">
						<label class="form-label" for="create-group-desc">[[admin/manage/groups:description]]</label>
						<input type="text" class="form-control" id="create-group-desc" placeholder="[[admin/manage/groups:description-placeholder]]" />
					</div>
					<div class="form-check form-switch mb-3">
						<input class="form-check-input" id="create-group-private" name="private" type="checkbox" checked>
						<label class="form-check-label" for="create-group-private">[[admin/manage/groups:private]]</label>
					</div>
					<div class="form-check form-switch mb-3">
						<input class="form-check-input" id="create-group-hidden" name="hidden" type="checkbox">
						<label class="form-check-label" for="create-group-hidden">[[admin/manage/groups:hidden]]</label>
					</div>
				</form>
			</div>
			<div class="modal-footer">
				<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
					[[global:close]]
				</button>
				<button type="button" class="btn btn-primary" id="create-modal-go">
					[[admin/manage/groups:create-button]]
				</button>
			</div>
		</div>
	</div>
</div>