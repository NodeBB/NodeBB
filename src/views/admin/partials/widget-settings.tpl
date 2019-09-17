<br />
<label>Title:</label>
<input type="text" class="form-control" name="title" placeholder="Title (only shown on some containers)" /><br />

<label>Container:</label>
<textarea rows="4" class="form-control container-html" name="container" placeholder="Drag and drop a container or enter HTML here."></textarea>

<br/>
<label>Groups:</label>
<div>
    <ul class="nav nav-tabs" role="tablist">
      <li role="presentation" class="active"><a href="#showto" aria-controls="showto" role="tab" data-toggle="tab">Show to</a></li>
      <li role="presentation"><a href="#hidefrom" aria-controls="hidefrom" role="tab" data-toggle="tab">Hide from</a></li>
    </ul>

    <div class="tab-content">
      <div role="tabpanel" class="tab-pane active" id="showto">
        <select name="groups" class="form-control" multiple size="10">
            <!-- BEGIN groups -->
            <option value="{groups.displayName}">{groups.displayName}</option>
            <!-- END groups -->
        </select>
      </div>
      <div role="tabpanel" class="tab-pane" id="hidefrom">
        <select name="groupsHideFrom" class="form-control" multiple size="10">
            <!-- BEGIN groups -->
            <option value="{groups.displayName}">{groups.displayName}</option>
            <!-- END groups -->
        </select>
      </div>
    </div>
</div>

<div class="checkbox">
<label><input name="hide-mobile" type="checkbox"> Hide on mobile?</input></label>
</div>
