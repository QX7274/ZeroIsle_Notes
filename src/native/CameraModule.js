const { NativeModules } = require('react-native');

const CameraModule = NativeModules.CameraModule || null;

const cameraWrapper = {
    takePicture: () => {
        if (!CameraModule) {
            return Promise.reject(new Error('CameraModule not available'));
        }
        return new Promise((resolve, reject) => {
            CameraModule.takePicture()
                .then(result => resolve(result))
                .catch(error => reject(error));
        });
    },

    startCamera: () => {
        if (CameraModule) {
            CameraModule.startCamera();
        }
    },

    stopCamera: () => {
        if (CameraModule) {
            CameraModule.stopCamera();
        }
    },
};

module.exports = cameraWrapper;
module.exports.default = cameraWrapper;
