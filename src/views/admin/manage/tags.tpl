<div class="tags row">
	<div class="col-lg-9">
		<div class="panel panel-default tag-management">
			<div class="panel-body">
				<div class="alert alert-info">
					<p>[[admin/manage/tags:description]]</p>
				</div>

				<!-- IF !tags.length -->
				[[admin/manage/tags:none]]
				<!-- ENDIF !tags.length -->

				<div class="tag-list">
					<!-- BEGIN tags -->
					<div class="tag-row" data-tag="{tags.valueEscaped}">
						<div>
							<span class="mdl-chip mdl-chip--contact tag-item" data-tag="{tags.valueEscaped}" style="
								<!-- IF tags.color -->color: {tags.color};<!-- ENDIF tags.color -->
								<!-- IF tags.bgColor -->background-color: {tags.bgColor};<!-- ENDIF tags.bgColor -->">
							    <span class="mdl-chip__contact mdl-color--light-blue mdl-color-text--white tag-topic-count">{tags.score}</span>
							    <span class="mdl-chip__text">{tags.valueEscaped}</span>
							</span>
						</div>
					</div>
					<!-- END tags -->
				</div>
			</div>
		</div>
	</div>

	<div class="col-lg-3 acp-sidebar">
		<div class="panel panel-default">
			<div class="panel-body">
				<button class="btn btn-primary btn-block" id="create">[[admin/manage/tags:create]]</button>
				<button class="btn btn-primary btn-block" id="rename">[[admin/manage/tags:rename]]</button>
				<button class="btn btn-warning btn-block" id="deleteSelected">[[admin/manage/tags:delete]]</button>
				<hr />
				<a class="btn btn-default btn-block" href="{config.relative_path}/admin/settings/tags">
					<i class="fa fa-external-link"></i>
					[[admin/manage/tags:settings]]
				</a>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-body">
				<input class="form-control" type="text" id="tag-search" placeholder="[[admin/manage/tags:search]]"/><br/>
			</div>
		</div>
	</div>

	<div class="modal fade" id="create-modal">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
					<h4 class="modal-title">[[admin/manage/tags:create]]</h4>
				</div>
				<div class="modal-body">
					<form>
						<div class="form-group">
							<label for="create-tag-name">[[admin/manage/tags:name]]</label>
							<input type="text" class="form-control" id="create-tag-name" placeholder="[[admin/manage/tags:name]]" />
						</div>
					</form>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-primary" id="create-modal-go">[[admin/manage/tags:create]]</button>
				</div>
			</div>
		</div>
	</div>

	<div class="rename-modal hidden">
		<div class="form-group">
			<label for="value">[[admin/manage/tags:name]]</label>
			<input id="value" data-name="value" value="" class="form-control" />
		</div>
	</div>
</div>
