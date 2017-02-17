'use strict';

/* globals define, socket, app, templates */

define('pictureCropper', ['translator', 'cropper'], function (translator, cropper) {

    var module = {};

    module.handleImageCrop = function (data, callback) {
		$('#crop-picture-modal').remove();
		templates.parse('modals/crop_picture', {url: data.url}, function (cropperHtml) {
			translator.translate(cropperHtml, function (translated) {
				var cropperModal = $(translated);
				cropperModal.modal('show');
				
				var img = document.getElementById('cropped-image');
				var cropperTool = new cropper.default(img, {
					aspectRatio: data.aspectRatio,
					viewMode: 1
				});
				
				cropperModal.find('.rotate').on('click', function () {
					var degrees = this.getAttribute("data-degrees");
					cropperTool.rotate(degrees);	
				});
				
				cropperModal.find('.flip').on('click', function () {
					var option = this.getAttribute("data-option");
					var method = this.getAttribute("data-method");
					method === 'scaleX' ? cropperTool.scaleX(option) : cropperTool.scaleY(option);
					this.setAttribute("data-option", option * -1);
				});
				
				cropperModal.find('.reset').on('click', function () {
					cropperTool.reset();	
				});
				
				cropperModal.find('.crop-btn').on('click', function () {
					$(this).addClass('disabled');
					var imageData = data.imageType ? cropperTool.getCroppedCanvas().toDataURL(data.imageType) : cropperTool.getCroppedCanvas().toDataURL();
					
					cropperModal.find('#upload-progress-bar').css('width', '100%');
					cropperModal.find('#upload-progress-box').show().removeClass('hide');
					
					var socketData = {};
					socketData[data.paramName] = data.paramValue;
					socketData['imageData'] = imageData;
					
					socket.emit(data.socketMethod, socketData, function (err, imageData) {
					    if (err) {
					        cropperModal.find('#upload-progress-box').hide();
					        cropperModal.find('.upload-btn').removeClass('disabled');
					        cropperModal.find('.crop-btn').removeClass('disabled');
					        return app.alertError(err.message);
					    }
					
					    callback(imageData.url);
					    cropperModal.modal('hide');
					});
				});
				
				cropperModal.find('.upload-btn').on('click', function () {
					$(this).addClass('disabled');
					cropperTool.destroy();
				
					cropperTool = new cropper.default(img, {
						viewMode: 1,
						autoCropArea: 1
					});
				
					cropperModal.find('.crop-btn').trigger('click');
				});
			});
		});
	};

	return module;
});
