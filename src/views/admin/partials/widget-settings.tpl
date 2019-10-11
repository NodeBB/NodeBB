<br />
<label>[[admin/extend/widgets:title]]</label>
<input type="text" class="form-control" name="title" placeholder="[[admin/extend/widgets:title.placeholder]]" /><br />

<label>[[admin/extend/widgets:container]]</label>
<textarea rows="4" class="form-control container-html" name="container" placeholder="[[admin/extend/widgets:container.placeholder]]"></textarea>

<br/>
<div class="row">
  <div class="col-lg-6">
    <label>[[admin/extend/widgets:show-to-groups]]</label>
    <select name="groups" class="form-control" multiple size="10">
        <!-- BEGIN groups -->
        <option value="{groups.displayName}">{groups.displayName}</option>
        <!-- END groups -->
    </select>
  </div>
  <div class="col-lg-6">
      <label>[[admin/extend/widgets:hide-from-groups]]</label>
      <select name="groups" class="form-control" multiple size="10">
          <!-- BEGIN groups -->
          <option value="{groups.displayName}">{groups.displayName}</option>
          <!-- END groups -->
      </select>
  </div>
</div>

<div class="checkbox">
<label><input name="hide-mobile" type="checkbox"> [[admin/extend/widgets:hide-on-mobile]]</input></label>
</div>
