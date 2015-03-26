<div class="row">
	<form role="form" class="category" data-cid="{category.cid}">
		<div class="col-md-9">
			<div class="panel panel-default">
				<div class="panel-heading"><i class="fa fa-folder"></i> Category Settings</div>
				<div class="panel-body category-settings-form">
					<fieldset>
						<div class="col-xs-12">
							<h3 data-edit-target="#cid-{category.cid}-name"><span>{category.name}</span> <small><i class="fa fa-edit"></i></small></h3>
							<input id="cid-{category.cid}-name" type="text" class="form-control hide" placeholder="Category Name" data-name="name" value="{category.name}" />
							<h4 data-edit-target="#cid-{category.cid}-description"><span>{category.description}</span> <small><i class="fa fa-edit"></i></small></h4>
							<input id="cid-{category.cid}-description" data-name="description" placeholder="Category Description" value="{category.description}" class="form-control category_description input-sm description hide"></input>
						</div>
					</fieldset>

					<fieldset>
						<div class="col-xs-12">
							<div class="form-group">
								<label for="cid-{category.cid}-parentCid">Parent Category</label>
								<!-- IF category.parent.name -->
								<br />
								<div class="btn-group">
									<button type="button" class="btn btn-default" data-action="setParent" data-parentCid="{category.parent.cid}"><i class="fa {category.parent.icon}"></i> {category.parent.name}</button>
									<button type="button" class="btn btn-warning" data-action="removeParent" data-parentCid="{category.parent.cid}"><i class="fa fa-times"></i></button>
								</div>
								<!-- ELSE -->
								<button type="button" class="btn btn-default form-control" data-action="setParent"><i class="fa fa-sitemap"></i> (None)</button>
								<!-- ENDIF category.parent.name -->
							</div>
						</div>
					</fieldset>
					<fieldset>
						<div class="col-sm-4 col-xs-12">
							<div class="form-group">
								<label for="cid-{category.cid}-bgColor">Background Colour</label>
								<input id="cid-{category.cid}-bgColor" placeholder="#0059b2" data-name="bgColor" value="{category.bgColor}" class="form-control category_bgColor" />
							</div>
						</div>
						<div class="col-sm-4 col-xs-12">
							<div class="form-group">
								<label for="cid-{category.cid}-color">Text Colour</label>
								<input id="cid-{category.cid}-color" placeholder="#fff" data-name="color" value="{category.color}" class="form-control category_color" />
							</div>
						</div>
						<div class="col-sm-4 col-xs-12">
							<div class="form-group">
								<label for="cid-{category.cid}-imageClass">Image Class</label>
									<select id="cid-{category.cid}-imageClass" class="form-control" data-name="imageClass" data-value="{category.imageClass}">
									<option value="auto">auto</option>
									<option value="cover">cover</option>
									<option value="contain">contain</option>
								</select>
							</div>
						</div>
						<div class="col-sm-4 col-xs-12">
							<div class="form-group">
								<label for="cid-{category.cid}-class">Custom Class</label>
								<input id="cid-{category.cid}-class" type="text" class="form-control" placeholder="col-md-6 col-xs-6" data-name="class" value="{category.class}" />
							</div>
						</div>
						<div class="col-sm-4 col-xs-12">
							<div class="form-group">
								<label for="cid-{category.cid}-numRecentReplies"># of Recent Replies</label>
								<input id="cid-{category.cid}-numRecentReplies" type="text" class="form-control" placeholder="2" data-name="numRecentReplies" value="{category.numRecentReplies}" />
							</div>
						</div>
						<div class="col-sm-4 col-xs-12">
							<div class="form-group">
								<label for="cid-{category.cid}-link">External Link</label>
								<input id="cid-{category.cid}-link" type="text" class="form-control" placeholder="http://domain.com" data-name="link" value="{category.link}" />
							</div>
						</div>
					</fieldset>
				</div>
			</div>

			<div class="panel panel-default">
				<div class="panel-heading"><i class="fa fa-key"></i> Privileges / Access Control</div>
				<div class="panel-body">
					<p>
						You can configure the access control privileges for this category in this section. Privileges can be granted on a per-user or
						a per-group basis. You can add a new user or group to this table by searching for them in the form below.
					</p>
					<p class="text-warning">
						<strong>Note</strong>: Privilege settings take effect immediately. It is not necessary to save the category after adjusting
						these settings.
					</p>
					<hr />
					<input class="form-control privilege-search" type="text" placeholder="Add a user or group to this list..." />
					<hr />
					<!-- IMPORT admin/partials/categories/privileges.tpl -->
				</div>
			</div>
		</div>

		<div class="col-md-3 options acp-sidebar">
			<div class="panel panel-default hidden-sm">
				<div class="panel-heading">Preview</div>
				<div class="panel-body">
					<div class="category-preview" style="
						<!-- IF category.backgroundImage -->background-image: url({category.backgroundImage});<!-- ENDIF category.backgroundImage -->
						<!-- IF category.bgColor -->background-color: {category.bgColor};<!-- ENDIF category.bgColor -->
						color: {category.color};
						background-size:cover;
					">
						<div class="icon">
							<i data-name="icon" value="{category.icon}" class="fa {category.icon} fa-2x"></i>
						</div>
					</div>
					<div class="btn-group btn-group-justified">
						<div class="btn-group">
							<button type="button" data-cid="{category.cid}" data-name="image" data-value="{category.image}" class="btn btn-default upload-button"><i class="fa fa-upload"></i> Upload</button>
						</div>
						<!-- IF category.image -->
						<div class="btn-group">
							<button class="btn btn-warning delete-image"><i data-name="icon" value="fa-times" class="fa fa-times"></i> Remove</button>
						</div>
						<!-- ENDIF category.image -->
					</div>
				</div>
			</div>

			<div class="panel panel-default">
				<div class="panel-heading">Categories Control Panel</div>
				<div class="panel-body">
					<div class="btn-group btn-group-justified">
						<div class="btn-group">
							<button class="btn btn-primary save">Save</button>
						</div>
						<div class="btn-group">
							<button class="btn btn-default revert">Revert</button>
						</div>
					</div>
					<hr />
					<button class="btn btn-danger btn-block btn-xs purge"><i class="fa fa-eraser"></i> Purge Category</button>
					<p class="help-block">
						Purging a category will remove all topics and posts, and delete the category from the database. If you want to
						remove a category <em>temporarily</em>, you'll want to "disable" the category instead.
					</p>
				</div>
			</div>
		</div>
	</form>
</div>

<input type="hidden" template-variable="cid" value="{category.cid}" />