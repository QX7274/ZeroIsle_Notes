import { NativeModules } from 'react-native';

const { CameraModule } = NativeModules;

export default {
    takePicture: () => {
        return new Promise((resolve, reject) => {
            CameraModule.takePicture()
                .then(result => resolve(result))
                .catch(error => reject(error));
        });
    },

    startCamera: () => {
        CameraModule.startCamera();
    },

    stopCamera: () => {
        CameraModule.stopCamera();
    },
}; 