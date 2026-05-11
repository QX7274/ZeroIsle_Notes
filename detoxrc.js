/** @type {Detox.DetoxConfig} */
module.exports = {
    testRunner: {
        args: {
            '$0': 'node node_modules/jest/bin/jest.js',
            config: 'e2e/jest.config.js',
        },
        jest: {
            setupTimeout: 120000,
        },
    },
    apps: {
        'ios.debug': {
            type: 'ios.app',
            binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/ZeroIsleNotes.app',
            build: 'xcodebuild -workspace ios/ZeroIsleNotes.xcworkspace -scheme ZeroIsleNotes -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
        },
        'android.debug': {
            type: 'android.apk',
            binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
            testBinaryPath: 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
            build: 'cd android && gradlew.bat assembleDebug assembleAndroidTest -DtestBuildType=debug',
        },
    },
    devices: {
        simulator: {
            type: 'ios.simulator',
            device: {
                type: 'iPhone 15',
            },
        },
        emulator: {
            type: 'android.emulator',
            device: {
                avdName: 'Pixel_3a_API_33_x86_64',
            },
        },
        attached: {
            type: 'android.attached',
            device: {
                adbName: 'HGR3Y9MA',
            },
        },
    },
    configurations: {
        'ios.sim.debug': {
            device: 'simulator',
            app: 'ios.debug',
        },
        'android.emu.debug': {
            device: 'emulator',
            app: 'android.debug',
        },
        'android.att.debug': {
            device: 'attached',
            app: 'android.debug',
        },
    },
};
