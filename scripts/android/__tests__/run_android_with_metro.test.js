const {
  buildMetroArgs,
  buildRunAndroidArgs,
  buildAdbInvocation,
  getDeviceSelector,
  getMetroPort,
  getMetroSpawnOptions,
  buildAndroidBundlePath,
  selectAvailableMetroPort,
  shouldPersistMetroAfterRun,
} = require('../run_android_with_metro');

describe('run_android_with_metro argument planning', () => {
  test('starts Metro with bounded non-interactive options and forwards the selected port', () => {
    expect(buildMetroArgs(8081, 1)).toEqual([
      'node_modules/react-native/cli.js',
      'start',
      '--port',
      '8081',
      '--no-interactive',
      '--max-workers',
      '1',
    ]);
  });

  test('forces the Android CLI to reuse the wrapper-owned Metro process', () => {
    expect(buildRunAndroidArgs(['--deviceId', 'HGR3Y9MA'])).toEqual([
      'run-android',
      '--deviceId',
      'HGR3Y9MA',
      '--no-packager',
    ]);

    expect(buildRunAndroidArgs(['--deviceId', 'HGR3Y9MA'], 8084)).toEqual([
      'run-android',
      '--deviceId',
      'HGR3Y9MA',
      '--port',
      '8084',
      '--no-packager',
    ]);

    expect(buildRunAndroidArgs(['--no-packager', '--deviceId', 'HGR3Y9MA'])).toEqual([
      'run-android',
      '--no-packager',
      '--deviceId',
      'HGR3Y9MA',
    ]);
  });

  test('reads port and device selector without losing explicit user arguments', () => {
    const args = ['--port', '8090', '--device', 'tablet-serial', '--verbose'];
    expect(getMetroPort(args, {})).toBe('8090');
    expect(getDeviceSelector(args)).toBe('tablet-serial');
  });

  test('does not reuse an occupied Metro port', () => {
    expect(selectAvailableMetroPort(8081, port => ![8081, 8082].includes(port))).toBe(8083);
  });

  test('adds non-streaming only to ADB install commands', () => {
    expect(buildAdbInvocation(['-s', 'tablet-serial', 'install', '-r', '-d', 'app.apk'])).toEqual([
      '-s',
      'tablet-serial',
      'install',
      '-r',
      '-d',
      'app.apk',
      '--no-streaming',
    ]);
    expect(buildAdbInvocation(['-s', 'tablet-serial', 'reverse', 'tcp:8081', 'tcp:8081'])).toEqual([
      '-s',
      'tablet-serial',
      'reverse',
      'tcp:8081',
      'tcp:8081',
    ]);
  });

  test('keeps Metro alive after a successful Android launch for device debugging', () => {
    expect(shouldPersistMetroAfterRun({code: 0, signal: null})).toBe(true);
    expect(shouldPersistMetroAfterRun({code: 1, signal: null})).toBe(false);
    expect(shouldPersistMetroAfterRun({code: 0, signal: 'SIGTERM'})).toBe(false);
  });

  test('starts Metro as a detached process so Yarn does not reap it', () => {
    expect(getMetroSpawnOptions()).toEqual(
      expect.objectContaining({detached: true, windowsHide: true, stdio: 'ignore'}),
    );
  });

  test('prewarms the Android bundle before launching the device app', () => {
    expect(buildAndroidBundlePath()).toBe(
      '/index.bundle?platform=android&dev=true&minify=false&modulesOnly=false&runModule=true',
    );
  });
});
