<br />
<label>Title:</label>
<input type="text" class="form-control" name="title" placeholder="Title (only shown on some containers)" /><br />

<label>Container:</label>
<textarea rows="4" class="form-control container-html" name="container" placeholder="Drag and drop a container or enter HTML here."></textarea>

<br/>
<label>Groups:</label>
<div>
    <select name="groups" class="form-control" multiple size="10">
        <!-- BEGIN groups -->
        <option value="{groups.displayName}">{groups.displayName}</option>
        <!-- END groups -->
    </select>
</div>

<div class="checkbox">
<label><input name="hide-mobile" type="checkbox"> Hide on mobile?</input></label>
</div>
