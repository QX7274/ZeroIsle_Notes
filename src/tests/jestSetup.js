// Minimal setup for debugging
console.log('Jest setup loaded');

global.performance = {
    now: jest.fn(() => Date.now()),
};


jest.mock('react-native', () => {
    return {
        Animated: {
            createAnimatedComponent: (c) => c || 'Component',
            View: 'View',
            Text: 'Text',
            Image: 'Image',
            ScrollView: 'ScrollView',
            timing: () => ({ start: () => { } }),
            spring: () => ({ start: () => { } }),
            sequence: (...args) => ({ start: () => { } }),
            Value: class {
                constructor(v) { this.value = v; }
                interpolate() { return this; }
                setValue() { }
            },
        },
        View: 'View',
        Text: 'Text',
        Image: 'Image',
        ScrollView: 'ScrollView',
        TextInput: 'TextInput',
        Switch: 'Switch',
        Modal: 'Modal',
        Pressable: 'Pressable',
        FlatList: 'FlatList',
        SectionList: 'SectionList',
        VirtualizedList: 'VirtualizedList',
        SafeAreaView: 'SafeAreaView',
        ActivityIndicator: 'ActivityIndicator',
        RefreshControl: 'RefreshControl',
        StatusBar: 'StatusBar',
        StyleSheet: {
            create: (style) => style,
            flatten: (style) => style,
            absoluteFill: {},
        },
        Platform: {
            OS: 'ios',
            select: (objs) => objs.ios,
        },
        TouchableOpacity: 'TouchableOpacity',
        TouchableHighlight: 'TouchableHighlight',
        TouchableWithoutFeedback: 'TouchableWithoutFeedback',
        Dimensions: {
            get: () => ({ width: 375, height: 812 }),
            addEventListener: () => ({ remove: () => { } }),
        },
        Easing: {
            linear: (t) => t,
            ease: (t) => t,
            inOut: (t) => t,
            bezier: () => (t) => t,
        },
        PixelRatio: {
            get: () => 1,
        },
        requireNativeComponent: (name) => name,
        I18nManager: {
            isRTL: false,
            allowRTL: jest.fn(),
            forceRTL: jest.fn(),
            swapLeftAndRightInRTL: jest.fn(),
            getConstants: () => ({ isRTL: false }),
        },
        NativeModules: {},
        NativeEventEmitter: class NativeEventEmitter {
            addListener() { return { remove: () => { } }; }
            removeAllListeners() { }
        },
    };
});

// Mock react-native-linear-gradient
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
}));

// Mock react-native-image-picker
jest.mock('react-native-image-picker', () => ({
    launchImageLibrary: jest.fn(async () => ({ didCancel: false, assets: [] })),
    launchCamera: jest.fn(async () => ({ didCancel: false, assets: [] })),
}));

// Mock react-native-markdown-display
jest.mock('react-native-markdown-display', () => 'Markdown');

// Mock datetime picker
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

// Mock clipboard
jest.mock('@react-native-clipboard/clipboard', () => ({
    setString: jest.fn(),
    getString: jest.fn(async () => ''),
}));

// Mock safe area context
jest.mock('react-native-safe-area-context', () => ({
    SafeAreaProvider: ({ children }) => children,
    SafeAreaConsumer: ({ children }) => children({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 375, height: 812 }),
}));

// Mock Realm
jest.mock('realm', () => {
    class Realm {
        constructor() { }
        static open(config) { return Promise.resolve(new Realm()); }
        write(fn) { fn(); }
        create(type, data, mode) { return { ...data }; }
        objects(type) {
            return {
                filtered: () => ({ sorted: () => [], toJSON: () => [] }),
                sorted: () => [],
                toJSON: () => [],
            };
        }
        delete(obj) { }
        close() { }
        addListener() { }
        removeListener() { }
        removeAllListeners() { }
    }

    Realm.BSON = {
        ObjectId: class ObjectId {
            toHexString() {
                return '507f1f77bcf86cd799439011';
            }
        },
    };

    return Realm;
});

// Mocking native modules if necessary but keeping it minimal for now
jest.mock('react-native-gesture-handler', () => { });
jest.mock('react-native-reanimated', () => {
    const View = require('react-native').View;
    const Reanimated = {
        createAnimatedComponent: (c) => c || 'Component',
        View: View,
        Text: 'Text',
        Image: 'Image',
        ScrollView: 'ScrollView',
        call: () => { },
        useSharedValue: (v) => ({ value: v }),
        useAnimatedStyle: (cb) => cb() || {},
        withSequence: (...args) => args[0],
        withTiming: (to) => to,
        withSpring: (to) => to,
        interpolateColor: () => '#000000',
        Easing: { inOut: (fn) => fn, ease: (fn) => fn, linear: (fn) => fn },
        runOnJS: (fn) => fn,
    };
    return {
        __esModule: true,
        default: Reanimated,
        ...Reanimated,
    };
});

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('react-native-vector-icons/Feather', () => 'Icon');
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

// Mock WebView
jest.mock('react-native-webview', () => {
    const { View } = require('react-native');
    return {
        WebView: (props) => 'WebView',
        default: (props) => 'WebView',
    };
});

// Mock react-native-fs
jest.mock('react-native-fs', () => ({
    mkdir: jest.fn(),
    moveFile: jest.fn(),
    copyFile: jest.fn(),
    pathForBundle: jest.fn(),
    pathForGroup: jest.fn(),
    getFSInfo: jest.fn(),
    getAllExternalFilesDirs: jest.fn(),
    unlink: jest.fn(),
    exists: jest.fn(),
    stopDownload: jest.fn(),
    resumeDownload: jest.fn(),
    isResumable: jest.fn(),
    stopUpload: jest.fn(),
    completeHandlerIOS: jest.fn(),
    readDir: jest.fn(),
    readDirAssets: jest.fn(),
    existsAssets: jest.fn(),
    readdir: jest.fn(),
    setReadable: jest.fn(),
    stat: jest.fn(),
    readFile: jest.fn(),
    read: jest.fn(),
    readFileAssets: jest.fn(),
    hash: jest.fn(),
    copyFileAssets: jest.fn(),
    copyFileAssetsIOS: jest.fn(),
    copyAssetsVideoIOS: jest.fn(),
    writeFile: jest.fn(),
    appendFile: jest.fn(),
    write: jest.fn(),
    downloadFile: jest.fn(),
    uploadFiles: jest.fn(),
    touch: jest.fn(),
    MainBundlePath: 'test/path',
    CachesDirectoryPath: 'test/cache',
    DocumentDirectoryPath: 'test/documents',
    ExternalDirectoryPath: 'test/external',
    ExternalStorageDirectoryPath: 'test/external_storage',
    TemporaryDirectoryPath: 'test/temp',
    LibraryDirectoryPath: 'test/library',
    PicturesDirectoryPath: 'test/pictures',
}));

// Mock react-native-blob-util
jest.mock('react-native-blob-util', () => ({
    DocumentDir: () => 'test/documents',
    CacheDir: () => 'test/cache',
    PictureDir: () => 'test/pictures',
    MusicDir: () => 'test/music',
    DownloadDir: () => 'test/download',
    DCIMDir: () => 'test/dcim',
    SDCardDir: () => 'test/sdcard',
    SDCardApplicationDir: () => 'test/sdcardApp',
    MainBundleDir: () => 'test/bundle',
    LibraryDir: () => 'test/library',
}));

