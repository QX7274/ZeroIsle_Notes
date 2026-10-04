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
        // @react-native-community/slider 在渲染期调用 Image.resolveAssetSource，
        // 老 mock 把 Image 写成了字符串，导致任何包含 Slider 的组件无法被渲染测试
        // （工具栏的全部渲染级测试都因此从未真正跑起来过）。
        // RNTL 会用 <Image testID="image"> 探测宿主组件名，所以这里必须是真组件而不是字符串。
        Image: Object.assign(
            function Image(props) {
                // jest.mock 工厂不允许引用外部变量，这里用 require 在调用时才解析 React
                // （require 本身在工厂允许列表内）。
                const ReactLocal = require('react');
                return ReactLocal.createElement('Image', props, props?.children ?? null);
            },
            { resolveAssetSource: () => ({ uri: '', width: 0, height: 0, scale: 1 }) }
        ),
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
        // react-native-svg 的 SvgTouchableMixin 会读 RN 的 Touchable.Mixin；
        // 该 mock 以前没有这个导出，导致任何 import react-native-svg 的组件在测试里
        // 直接抛 "Cannot destructure property 'Mixin' of Touchable as it is undefined"。
        // 这里补最小占位，让组件能被渲染测试覆盖（不改变真机行为）。
        Touchable: {
            Mixin: {
                touchableGetInitialState: () => ({}),
                touchableHandleStartShouldSetResponder: () => true,
                touchableHandleResponderGrant: () => {},
                touchableHandleResponderMove: () => {},
                touchableHandleResponderRelease: () => {},
                touchableHandleResponderTerminate: () => {},
                touchableHandleResponderTerminationRequest: () => false,
            },
        },
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
        // RN 官方推荐用 useWindowDimensions 拿响应式尺寸（旋转/分屏/平板模式切换会自动更新）。
        // 老 mock 没提供它，于是任何使用该 Hook 的组件在测试里直接崩。
        useWindowDimensions: () => ({
            width: 375,
            height: 812,
            scale: 1,
            fontScale: 1,
        }),
        // react-native-svg 的属性提取逻辑直接调用 RN 的 processColor；
        // 补一个「原样返回」的实现，缺失时任何 svg 组件都会在 import 阶段崩掉。
        processColor: (color) => color,
        // react-native-svg 在模块加载期就会 Object.keys(PanResponder.create({}).panHandlers)，
        // 缺这个导出会让整个 svg 包 import 失败。
        PanResponder: {
            create: () => ({ panHandlers: {} }),
        },
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

    Realm.Object = class RealmObject {};

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

