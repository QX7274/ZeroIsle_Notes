const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const {execFileSync, spawn} = require('child_process');

const DEFAULT_METRO_PORT = '8081';
const DEFAULT_MAX_WORKERS = '1';
const DEFAULT_READY_TIMEOUT_MS = 300000;
const DEFAULT_BUNDLE_TIMEOUT_MS = 300000;
const READY_POLL_INTERVAL_MS = 1000;

function buildAndroidBundlePath() {
  return '/index.bundle?platform=android&dev=true&minify=false&modulesOnly=false&runModule=true';
}

function readFlagValue(args, flag) {
  const equalsPrefix = `${flag}=`;
  const equalsArg = args.find(arg => arg.startsWith(equalsPrefix));
  if (equalsArg) {
    return equalsArg.slice(equalsPrefix.length);
  }

  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function getMetroPort(args, env = process.env) {
  return String(readFlagValue(args, '--port') || env.RCT_METRO_PORT || DEFAULT_METRO_PORT);
}

function getDeviceSelector(args) {
  return readFlagValue(args, '--device') || readFlagValue(args, '--deviceId');
}

function buildMetroArgs(port, maxWorkers = DEFAULT_MAX_WORKERS) {
  return [
    'node_modules/react-native/cli.js',
    'start',
    '--port',
    String(port),
    '--no-interactive',
    '--max-workers',
    String(maxWorkers),
  ];
}

function buildRunAndroidArgs(userArgs, metroPort) {
  const args = ['run-android', ...userArgs];
  if (metroPort !== undefined) {
    const portArgIndex = args.findIndex(arg => arg === '--port' || arg.startsWith('--port='));
    if (portArgIndex >= 0 && args[portArgIndex].startsWith('--port=')) {
      args[portArgIndex] = `--port=${metroPort}`;
    } else if (portArgIndex >= 0) {
      args[portArgIndex + 1] = String(metroPort);
    } else {
      args.push('--port', String(metroPort));
    }
  }

  return userArgs.includes('--no-packager') ? args : [...args, '--no-packager'];
}

function buildAdbInvocation(args) {
  const commandWithValue = new Set(['-s', '-H', '-P', '-L', '--one-device']);
  let commandIndex = 0;
  while (commandIndex < args.length && args[commandIndex].startsWith('-')) {
    commandIndex += commandWithValue.has(args[commandIndex]) ? 2 : 1;
  }

  const command = args[commandIndex]?.toLowerCase();
  const installCommands = new Set(['install', 'install-multiple', 'install-multi-package']);
  if (!installCommands.has(command) || args.includes('--no-streaming')) {
    return args;
  }

  return [...args, '--no-streaming'];
}

function requestMetroStatus(port, timeoutMs = 2000) {
  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const request = http.get(
      {
        hostname: '127.0.0.1',
        path: '/status',
        port: Number(port),
        timeout: timeoutMs,
      },
      response => {
        finish(response.statusCode === 200);
        response.resume();
      },
    );
    request.on('error', () => finish(false));
    request.on('timeout', () => {
      request.destroy();
      finish(false);
    });
  });
}

function requestMetroBundle(port, timeoutMs = DEFAULT_BUNDLE_TIMEOUT_MS) {
  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const request = http.get(
      {
        hostname: '127.0.0.1',
        path: buildAndroidBundlePath(),
        port: Number(port),
        timeout: timeoutMs,
      },
      response => {
        response.on('error', () => finish(false));
        response.on('end', () => finish(response.statusCode === 200));
        response.resume();
      },
    );
    request.on('error', () => finish(false));
    request.on('timeout', () => {
      request.destroy();
      finish(false);
    });
  });
}

function selectAvailableMetroPort(startPort, isAvailable) {
  const firstPort = Number(startPort);
  for (let offset = 0; offset < 64; offset += 1) {
    const candidate = firstPort + offset;
    if (isAvailable(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to find an available Metro port from ${firstPort}`);
}

function isPortAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    const finish = available => {
      server.removeAllListeners();
      resolve(available);
    };

    server.once('error', () => finish(false));
    server.listen(Number(port), '0.0.0.0', () => {
      server.close(() => finish(true));
    });
  });
}

async function findAvailableMetroPort(startPort) {
  for (let offset = 0; offset < 64; offset += 1) {
    const candidate = Number(startPort) + offset;
    const metroResponding = await requestMetroStatus(candidate);
    if (!metroResponding && await isPortAvailable(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to find a free Metro port from ${startPort}`);
}

async function waitForMetro(port, timeoutMs = DEFAULT_READY_TIMEOUT_MS, child) {
  const deadline = Date.now() + timeoutMs;
  let childExited = false;
  const handleChildExit = () => {
    childExited = true;
  };
  child?.once('exit', handleChildExit);

  try {
    while (Date.now() < deadline) {
      if (childExited) {
        return false;
      }
      if (await requestMetroStatus(port)) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, READY_POLL_INTERVAL_MS));
    }
    return false;
  } finally {
    child?.removeListener('exit', handleChildExit);
  }
}

function createMetroEnvironment(root) {
  const cacheRoot = path.join(os.tmpdir(), 'metro-cache');
  return {
    runtimeRoot: null,
    env: {
      ...process.env,
      METRO_CACHE: cacheRoot,
      PROJECT_ROOT: root,
    },
  };
}

function getMetroSpawnOptions() {
  return {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  };
}

function terminateChild(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  if (process.platform === 'win32') {
    const killer = spawn(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/s', '/c', `taskkill /pid ${child.pid} /t /f`],
      {stdio: 'ignore', windowsHide: true},
    );
    killer.unref();
    return;
  }

  child.kill('SIGTERM');
}

function shouldPersistMetroAfterRun(result) {
  return Boolean(result && result.code === 0 && !result.signal);
}

function detachChild(child) {
  if (child && child.exitCode === null) {
    child.unref();
  }
}

function removeRuntime(runtimeRoot) {
  if (runtimeRoot) {
    fs.rmSync(runtimeRoot, {recursive: true, force: true});
  }
}

function resolveAdbExecutable(env = process.env) {
  const sdkRoot = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
  const sdkAdb = sdkRoot && path.join(sdkRoot, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  if (sdkAdb && fs.existsSync(sdkAdb)) {
    return sdkAdb;
  }

  const locator = process.platform === 'win32' ? 'where.exe' : 'which';
  try {
    const output = execFileSync(locator, ['adb'], {
      encoding: 'utf8',
      env,
      windowsHide: true,
    });
    const located = output
      .split(/\r?\n/)
      .map(value => value.trim())
      .find(Boolean);
    if (located) {
      return located;
    }
  } catch {
    // Fall through to the actionable error below.
  }

  throw new Error('Unable to locate adb. Set ANDROID_HOME or add platform-tools to PATH.');
}

function createAdbShim(env = process.env) {
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zeroisle-notes-adb-'));
  const realAdb = resolveAdbExecutable(env);
  const shimDirectory = path.join(runtimeRoot, 'bin');
  fs.mkdirSync(shimDirectory, {recursive: true});

  if (process.platform === 'win32') {
    const shimPath = path.join(shimDirectory, 'adb.cmd');
    const batchAdbPath = realAdb.replace(/%/g, '%%').replace(/"/g, '""');
    fs.writeFileSync(
      shimPath,
      [
        '@echo off',
        'setlocal EnableExtensions',
        `set "ZEROISLE_REAL_ADB=${batchAdbPath}"`,
        'set "ZEROISLE_ADB_COMMAND=%~1"',
        'if /I "%~1"=="-s" set "ZEROISLE_ADB_COMMAND=%~3"',
        'if /I "%ZEROISLE_ADB_COMMAND%"=="install" goto install',
        'if /I "%ZEROISLE_ADB_COMMAND%"=="install-multiple" goto install',
        'if /I "%ZEROISLE_ADB_COMMAND%"=="install-multi-package" goto install',
        '"%ZEROISLE_REAL_ADB%" %*',
        'exit /b %ERRORLEVEL%',
        ':install',
        '"%ZEROISLE_REAL_ADB%" %* --no-streaming',
        'exit /b %ERRORLEVEL%',
        '',
      ].join('\r\n'),
      'utf8',
    );
  } else {
    const shimPath = path.join(shimDirectory, 'adb');
    const quotedAdb = `'${realAdb.replace(/'/g, "'\\''")}'`;
    fs.writeFileSync(
      shimPath,
      `#!/bin/sh\nexec ${quotedAdb} "$@"\n`,
      {encoding: 'utf8', mode: 0o755},
    );
  }

  const childEnv = {
    ...env,
    PATH: `${shimDirectory}${path.delimiter}${env.PATH || ''}`,
  };
  // The RN CLI prefers ANDROID_HOME/platform-tools/adb over PATH. Keep the SDK
  // available through local.properties/ANDROID_SDK_ROOT while allowing the shim
  // to intercept the CLI's adb calls.
  if (childEnv.ANDROID_HOME) {
    delete childEnv.ANDROID_HOME;
  }

  return {runtimeRoot, env: childEnv};
}

function spawnProcess(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({code: code ?? 1, signal}));
  });
}

async function startOwnedMetro(root, port, maxWorkers, readyTimeoutMs) {
  const runtime = createMetroEnvironment(root);
  const child = spawn(process.execPath, buildMetroArgs(port, maxWorkers), {
    cwd: root,
    env: runtime.env,
    ...getMetroSpawnOptions(),
  });

  try {
    const ready = await waitForMetro(port, readyTimeoutMs, child);
    if (!ready) {
      terminateChild(child);
      throw new Error(`Metro did not become ready on port ${port} within ${readyTimeoutMs}ms`);
    }
    const bundleReady = await requestMetroBundle(port, DEFAULT_BUNDLE_TIMEOUT_MS);
    if (!bundleReady) {
      terminateChild(child);
      throw new Error(`Metro Android bundle did not become ready on port ${port}`);
    }
    return {child, runtimeRoot: runtime.runtimeRoot, owned: true};
  } catch (error) {
    removeRuntime(runtime.runtimeRoot);
    throw error;
  }
}

async function ensureMetro(root, port, maxWorkers, readyTimeoutMs) {
  const selectedPort = await findAvailableMetroPort(port);
  const ownedMetro = await startOwnedMetro(root, selectedPort, maxWorkers, readyTimeoutMs);
  return {...ownedMetro, port: selectedPort};
}

async function run() {
  const userArgs = process.argv.slice(2);
  const root = path.resolve(__dirname, '..', '..');
  const requestedPort = getMetroPort(userArgs);
  const maxWorkers = process.env.ZEROISLE_METRO_MAX_WORKERS || DEFAULT_MAX_WORKERS;
  const readyTimeoutMs = Number(
    process.env.ZEROISLE_METRO_READY_TIMEOUT_MS || DEFAULT_READY_TIMEOUT_MS,
  );
  const metro = await ensureMetro(root, requestedPort, maxWorkers, readyTimeoutMs);
  const adbShim = createAdbShim(process.env);
  let result;

  try {
    result = await spawnProcess(
      process.execPath,
      ['node_modules/react-native/cli.js', ...buildRunAndroidArgs(userArgs, metro.port)],
      {
      cwd: root,
      env: {...adbShim.env, RCT_METRO_PORT: String(metro.port)},
      stdio: 'inherit',
      windowsHide: true,
      },
    );
    if (result.signal) {
      process.kill(process.pid, result.signal);
    }
    return result.code;
  } finally {
    if (metro.owned) {
      if (shouldPersistMetroAfterRun(result)) {
        detachChild(metro.child);
      } else {
        terminateChild(metro.child);
        removeRuntime(metro.runtimeRoot);
      }
    }
    removeRuntime(adbShim.runtimeRoot);
  }
}

module.exports = {
  buildMetroArgs,
  buildAndroidBundlePath,
  buildRunAndroidArgs,
  buildAdbInvocation,
  createAdbShim,
  createMetroEnvironment,
  getMetroSpawnOptions,
  getDeviceSelector,
  getMetroPort,
  selectAvailableMetroPort,
  findAvailableMetroPort,
  resolveAdbExecutable,
  requestMetroStatus,
  requestMetroBundle,
  shouldPersistMetroAfterRun,
  waitForMetro,
};

if (require.main === module) {
  run()
    .then(code => process.exit(code))
    .catch(error => {
      console.error(error.stack || error.message || error);
      process.exit(1);
    });
}
