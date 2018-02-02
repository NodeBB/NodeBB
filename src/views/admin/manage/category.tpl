<form role="form" class="category" data-cid="{category.cid}">
	<div class="row">
		<div class="col-md-3 pull-right">
			<select id="category-selector" class="form-control">
				<!-- BEGIN allCategories -->
				<option value="{allCategories.value}" <!-- IF allCategories.selected -->selected<!-- ENDIF allCategories.selected -->>{allCategories.text}</option>
				<!-- END allCategories -->
			</select>
		</div>
	</div>

	<br/>

	<div class="row">
		<div class="col-md-9" id="category-settings">
			<div class="category-settings-form">
				<fieldset>
					<label for="cid-{category.cid}-name">
						[[admin/manage/categories:name]]
					</label>
					<input id="cid-{category.cid}-name" type="text" class="form-control" placeholder="[[admin/manage/categories:name]]" data-name="name" value="{category.name}" /><br />

					<label for="cid-{category.cid}-description">
						[[admin/manage/categories:description]]
					</label>
					<input id="cid-{category.cid}-description" data-name="description" placeholder="[[admin/manage/categories:description]]" value="{category.description}" class="form-control category_description description" /><br />
				</fieldset>

				<fieldset class="row">
					<div class="col-sm-4 col-xs-12">
						<div class="form-group">
							<label for="cid-{category.cid}-bgColor">
								[[admin/manage/categories:bg-color]]
							</label>
							<input id="cid-{category.cid}-bgColor" placeholder="#0059b2" data-name="bgColor" value="{category.bgColor}" class="form-control category_bgColor" />
						</div>
					</div>
					<div class="col-sm-4 col-xs-12">
						<div class="form-group">
							<label for="cid-{category.cid}-color">
								[[admin/manage/categories:text-color]]
							</label>
							<input id="cid-{category.cid}-color" placeholder="#fff" data-name="color" value="{category.color}" class="form-control category_color" />
						</div>
					</div>
					<div class="col-sm-4 col-xs-12">
						<div class="form-group">
							<label for="cid-{category.cid}-imageClass">
								[[admin/manage/categories:bg-image-size]]
							</label>
							<select id="cid-{category.cid}-imageClass" class="form-control" data-name="imageClass" data-value="{category.imageClass}">
								<option value="auto">auto</option>
								<option value="cover">cover</option>
								<option value="contain">contain</option>
							</select>
						</div>
					</div><br />
					<div class="col-sm-4 col-xs-12">
						<div class="form-group">
							<label for="cid-{category.cid}-class">
								[[admin/manage/categories:custom-class]]
							</label>
							<input id="cid-{category.cid}-class" type="text" class="form-control" placeholder="col-md-6 col-xs-6" data-name="class" value="{category.class}" />
						</div>
					</div>
					<div class="col-sm-4 col-xs-12">
						<div class="form-group">
							<label for="cid-{category.cid}-numRecentReplies">
								[[admin/manage/categories:num-recent-replies]]
							</label>
							<input id="cid-{category.cid}-numRecentReplies" type="text" class="form-control" placeholder="2" data-name="numRecentReplies" value="{category.numRecentReplies}" />
						</div>
					</div>
					<div class="col-sm-4 col-xs-12">
						<div class="form-group">
							<label for="cid-{category.cid}-link">
								[[admin/manage/categories:ext-link]]
							</label>
							<input id="cid-{category.cid}-link" type="text" class="form-control" placeholder="http://domain.com" data-name="link" value="{category.link}" />
						</div>
					</div>
					<div class="col-sm-6 col-xs-12">
						<div class="form-group">
							<div class="checkbox">
								<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
									<input type="checkbox" class="mdl-switch__input" id="cid-{category.cid}-isSection" data-name="isSection" <!-- IF category.isSection -->checked<!-- ENDIF category.isSection --> />
									<span class="mdl-switch__label"><strong>[[admin/manage/categories:is-section]]</strong></span>
								</label>
							</div>
						</div>
					</div>
				</fieldset>
				<fieldset>
					<label for="tag-whitelist">Tag Whitelist</label><br />
					<input id="tag-whitelist" type="text" class="form-control" placeholder="Enter category tags here" data-name="tagWhitelist" value="" />
				</fieldset>
			</div>
		</div>

		<div class="col-md-3 options acp-sidebar">
			<div class="panel panel-default">
				<div class="panel-body">
					<div class="category-preview" style="
						<!-- IF category.backgroundImage -->background-image: url({category.backgroundImage});<!-- ENDIF category.backgroundImage -->
						<!-- IF category.bgColor -->background-color: {category.bgColor};<!-- ENDIF category.bgColor -->
						<!-- IF category.imageClass -->background-size: {category.imageClass};<!-- ENDIF category.imageClass -->
						color: {category.color};
					">
						<div class="icon">
							<i data-name="icon" value="{category.icon}" class="fa {category.icon} fa-2x"></i>
						</div>
					</div>
					<div class="btn-group btn-group-justified">
						<div class="btn-group">
							<button type="button" data-cid="{category.cid}" class="btn btn-default upload-button">
								<i class="fa fa-upload"></i>
								[[admin/manage/categories:upload-image]]
							</button>
						</div>
						<!-- IF category.image -->
						<div class="btn-group">
							<button class="btn btn-warning delete-image">
								<i data-name="icon" value="fa-times" class="fa fa-times"></i>
								[[admin/manage/categories:delete-image]]
							</button>
						</div>
						<!-- ENDIF category.image -->
					</div><br />

					<fieldset>
						<div class="form-group text-center">
							<label for="category-image">
								[[admin/manage/categories:category-image]]
							</label>
							<br/>
							<input id="category-image" type="text" class="form-control" placeholder="[[admin/manage/categories:category-image]]" data-name="image" value="{category.image}" />
						</div>
					</fieldset>

					<fieldset>
						<div class="form-group text-center">
							<label for="cid-{category.cid}-parentCid">[[admin/manage/categories:parent-category]]</label>
							<br/>
							<div class="btn-group <!-- IF !category.parent.name -->hide<!-- ENDIF !category.parent.name -->">
								<button type="button" class="btn btn-default" data-action="changeParent" data-parentCid="{category.parent.cid}"><i class="fa {category.parent.icon}"></i> {category.parent.name}</button>
								<button type="button" class="btn btn-warning" data-action="removeParent" data-parentCid="{category.parent.cid}"><i class="fa fa-times"></i></button>
							</div>
							<button type="button" class="btn btn-default btn-block <!-- IF category.parent.name -->hide<!-- ENDIF category.parent.name -->" data-action="setParent">
								<i class="fa fa-sitemap"></i>
								[[admin/manage/categories:parent-category-none]]
							</button>
						</div>
					</fieldset>
					<hr/>
					<button class="btn btn-info btn-block copy-settings">
						<i class="fa fa-files-o"></i> [[admin/manage/categories:copy-settings]]
					</button>
					<hr />
					<button class="btn btn-danger btn-block purge">
						<i class="fa fa-eraser"></i> [[admin/manage/categories:purge]]
					</button>
				</div>
			</div>
		</div>
	</div>
</form>

<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
    <i class="material-icons">save</i>
</button>
