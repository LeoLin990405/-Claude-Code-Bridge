import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerWix } from '@electron-forge/maker-wix';
// Import MakerSquirrel conditionally to avoid issues on non-Windows
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MakerSquirrel = process.platform === 'win32' ? require('@electron-forge/maker-squirrel').MakerSquirrel : null;
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import path from 'path';
import fs from 'fs';
import { mainConfig } from './config/webpack/webpack.config';
import { rendererConfig } from './config/webpack/webpack.renderer.config';
import packageJson from './package.json';

// Allow developers to override the npm start dev-server/logging ports without touching code.
// 允许开发者通过环境变量修改 dev server / 日志端口，无需改代码
const DEFAULT_DEV_SERVER_PORT = 3000;
const DEFAULT_LOGGER_PORT = 9000;
const DEV_PORT_ENV_KEYS = ['HIVEMIND_DEV_PORT', 'DEV_SERVER_PORT', 'PORT'] as const;
const LOGGER_PORT_ENV_KEYS = ['HIVEMIND_LOGGER_PORT', 'DEV_LOGGER_PORT', 'LOGGER_PORT'] as const;

const parsePort = (value?: string | null): number | null => {
  if (!value) return null;
  const port = Number.parseInt(value, 10);
  if (Number.isFinite(port) && port > 0 && port < 65536) {
    return port;
  }
  console.warn(`[dev-server] Ignoring invalid port value: ${value}`);
  return null;
};

const resolveDevServerPort = (): { port: number; overridden: boolean } => {
  // Check well-known env vars (priority order). Fallback to default when none provided.
  // 依次检查常见环境变量，若未设置则退回默认端口
  for (const key of DEV_PORT_ENV_KEYS) {
    const port = parsePort(process.env[key]);
    if (port) {
      console.log(`[dev-server] Using ${key}=${port}`);
      return { port, overridden: true };
    }
  }
  return { port: DEFAULT_DEV_SERVER_PORT, overridden: false };
};

const resolveLoggerPort = (devPort: number, devPortOverridden: boolean): number => {
  for (const key of LOGGER_PORT_ENV_KEYS) {
    const port = parsePort(process.env[key]);
    if (port) {
      console.log(`[dev-server] Using ${key}=${port}`);
      return port;
    }
  }

  if (devPortOverridden) {
    // Shift logger port away from the custom dev port to avoid conflicts.
    // 当自定义 dev 端口时，将日志端口偏移，避免冲突
    const candidate = devPort + 1 <= 65535 ? devPort + 1 : devPort - 1;
    console.log(`[dev-server] Auto-selecting logger port ${candidate} based on dev port ${devPort}`);
    return candidate;
  }

  return DEFAULT_LOGGER_PORT;
};

const { port: devServerPort, overridden: isDevPortOverridden } = resolveDevServerPort();
const loggerPort = resolveLoggerPort(devServerPort, isDevPortOverridden);

const apkName = 'HiveMind_' + packageJson.version + '_' + (process.env.arch || process.arch);
const skipNativeRebuild = process.env.FORGE_SKIP_NATIVE_REBUILD === 'true';

// Use target arch from build script, not host arch
const targetArch = process.env.ELECTRON_BUILDER_ARCH || process.env.npm_config_target_arch || process.env.arch || process.arch;

// Removed custom outDir to maintain compatibility with macOS signing

// Forge is only used for compilation in hybrid setup
// Signing and notarization handled by electron-builder

// NPX-based approach eliminates the need for complex dependency packaging
// No longer need to copy and manage ACP bridge dependencies

module.exports = {
  packagerConfig: {
    asar: {
      unpack: '**/node_modules/{better-sqlite3,node-pty}/**/*',
    },
    executableName: 'HiveMind',
    out: path.resolve(__dirname, 'out'),
    tmpdir: path.resolve(__dirname, '../HiveMind-tmp'),
    extraResource: [path.resolve(__dirname, 'public'), path.resolve(__dirname, 'resources/native')],
    afterCopy: [
      (buildPath, electronVersion, platform, arch, callback) => {
        // Copy native modules directly to Resources/node_modules
        const nativeModules = ['better-sqlite3', 'bindings', 'file-uri-to-path', 'prebuild-install', 'detect-libc', 'node-gyp-build', '@mapbox', 'node-pty', 'web-tree-sitter', 'tree-sitter-bash', 'tree-sitter'];
        const nodeModulesPath = path.resolve(__dirname, 'node_modules');

        // Target is buildPath (which is the .app/Contents/Resources/)
        const targetPath = path.join(buildPath, 'node_modules');

        try {
          if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
          }

          nativeModules.forEach((module) => {
            const src = path.join(nodeModulesPath, module);
            const dest = path.join(targetPath, module);

            if (fs.existsSync(src)) {
              console.log(`[afterCopy] Copying ${module} to Resources/node_modules...`);
              fs.cpSync(src, dest, { recursive: true });
            }
          });

          callback();
        } catch (err) {
          console.error('[afterCopy] Error:', err);
          callback(err);
        }
      },
    ],
    win32metadata: {
      CompanyName: 'HiveMind',
      FileDescription: 'HiveMind Gateway 桌面客户端',
      OriginalFilename: 'HiveMind.exe',
      ProductName: 'HiveMind',
      InternalName: 'HiveMind',
      FileVersion: packageJson.version,
      ProductVersion: packageJson.version,
    },
    icon: path.resolve(__dirname, 'resources/app'), // 应用图标路径
    // Windows 特定配置
    platform: process.env.npm_config_target_platform || process.platform,
    // Use target arch from build script, not host arch
    // This ensures .webpack/{target-arch}/ matches the final package architecture
    arch: targetArch,
  },
  rebuildConfig: {
    // Force skip all native module rebuilding during packaging
    // We've already rebuilt them correctly with electron-rebuild
    onlyModules: [],
  },
  makers: [
    // Windows-specific makers (only on Windows)
    ...(MakerSquirrel
      ? [
          new MakerSquirrel(
            {
              name: 'HiveMind', // 必须与 package.json 的 name 一致
              authors: 'HiveMind', // 任意名称
              setupExe: apkName + '.exe',
              // 禁用自动更新
              remoteReleases: '',
              noMsi: true, // 禁用 MSI 安装程序
              // loadingGif: path.resolve(__dirname, "resources/install.gif"),
              iconUrl: path.resolve(__dirname, 'resources/app.ico'),
              setupIcon: path.resolve(__dirname, 'resources/app.ico'),
              // 添加更多 Windows 特定设置
              certificateFile: undefined, // 暂时禁用代码签名
              certificatePassword: undefined,
              // 修复安装路径问题
              setupMsi: undefined,
            },
            ['win32']
          ),
        ]
      : []),

    // Windows MSI installer (WiX) - alternative to Squirrel
    new MakerWix(
      {
        name: 'HiveMind',
        description: 'HiveMind Gateway 桌面客户端',
        exe: 'HiveMind',
        manufacturer: 'HiveMind',
        version: packageJson.version,
        ui: {
          chooseDirectory: true,
        },
      },
      ['win32']
    ),

    // Cross-platform ZIP maker
    new MakerZIP({}, ['darwin', 'win32']),

    // macOS-specific makers
    new MakerDMG(
      {
        name: apkName,
        format: 'ULFO',
        overwrite: true,
        iconSize: 80,
        icon: path.resolve(__dirname, 'resources/app.icns'),
      },
      ['darwin']
    ),

    // Linux makers - rpm优先，然后deb
    {
      name: '@electron-forge/maker-rpm',
      platforms: ['linux'],
      config: {
        options: {
          name: 'hivemind',
          description: packageJson.description,
        },
      },
    },
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: {
        options: {
          maintainer: 'HiveMind',
          description: packageJson.description,
        },
      },
    },
  ],
  plugins: [
    new WebpackPlugin({
      port: devServerPort,
      loggerPort,
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: '!!html-webpack-plugin/lib/loader.js?force=true!./public/index.html',
            js: './src/renderer/index.ts',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
            },
          },
        ],
      },
      devServer: {
        // 开发服务器配置
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        client: {
          overlay: {
            errors: true, // 显示错误
            warnings: false, // 不显示警告
          },
        },
      },
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: false, // Allow loading from app.asar.unpacked
    }),
  ],
  hooks: {
    postPackage: async (config, options) => {
      // Copy native modules and their dependencies after packaging
      const appPath = path.join(options.outputPaths[0], 'HiveMind.app');
      const resourcesPath = path.join(appPath, 'Contents', 'Resources');
      const targetPath = path.join(resourcesPath, 'node_modules');
      const nativeModules = ['better-sqlite3', 'node-pty', 'web-tree-sitter', 'tree-sitter-bash', 'tree-sitter', 'bindings', 'node-gyp-build', 'file-uri-to-path', '@mapbox', 'detect-libc', 'prebuild-install'];
      const nodeModulesPath = path.resolve(__dirname, 'node_modules');

      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }

      nativeModules.forEach((module) => {
        const src = path.join(nodeModulesPath, module);
        const dest = path.join(targetPath, module);

        if (fs.existsSync(src)) {
          console.log(`[postPackage] Copying ${module}...`);
          fs.cpSync(src, dest, { recursive: true });
        }
      });
    },
  },
};
