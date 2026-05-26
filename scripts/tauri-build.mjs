import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

// =============================================================================
// Mitru 配布ビルドスクリプト
//
// 設計方針:
//   1. spawnSync を `shell: true` で呼び、コマンドを単一文字列として渡す。
//      - これにより Node.js 18.20.2 / 20.12.2 / 21.7.3 以降で導入された
//        CVE-2024-27980 対策（Windows で `.bat`/`.cmd` の直接spawn禁止）を
//        正しく回避する。
//   2. npm/npm.cmd を介さない。`node_modules/.bin/tauri(.cmd)` を直接呼ぶ。
//      - これにより Windows 特有の `spawnSync npm.cmd EINVAL` を根本解消。
//   3. 誤プラットフォーム実行時は exit 1 を返し、CI で「成功扱い」になるのを防ぐ。
//
// 参考:
//   - https://nodejs.org/en/blog/vulnerability/april-2024-security-releases-2
//   - https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows
// =============================================================================

const SCRIPT_VERSION = "2026-05-14";

const target = process.argv[2] ?? "current";
const platform = process.platform;
const isWindows = platform === "win32";
const isMac = platform === "darwin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

console.log(`[tauri-build] script-version=${SCRIPT_VERSION} platform=${platform} node=${process.version}`);

/**
 * Tauri CLI をプロジェクト内 node_modules/.bin から直接呼ぶ。
 *
 * @param {string[]} tauriArgs 例: ["build", "--bundles", "nsis,msi"]
 * @returns {number} 終了コード
 */
function runTauri(tauriArgs) {
  const tauriBinaryName = isWindows ? "tauri.cmd" : "tauri";
  const tauriBin = path.join(projectRoot, "node_modules", ".bin", tauriBinaryName);

  if (!fs.existsSync(tauriBin)) {
    console.error("[tauri-build] Tauri CLI のバイナリが見つかりません。");
    console.error(`  期待パス: ${tauriBin}`);
    console.error("  `npm install` を実行してから再度お試しください。");
    return 1;
  }

  // shell: true で呼ぶので、引数を含めて1つの文字列にまとめる。
  // パスにスペースが含まれる可能性があるためバイナリパスはダブルクォートで包む。
  // cmd.exe / /bin/sh どちらでも同じ表記で安全に動く。
  const quotedBin = `"${tauriBin}"`;
  const command = [quotedBin, ...tauriArgs].join(" ");

  console.log(`[tauri-build] 実行: ${command}`);

  const result = spawnSync(command, {
    stdio: "inherit",
    shell: true,
    cwd: projectRoot,
    env: process.env,
  });

  if (result.error) {
    console.error("[tauri-build] Tauri CLI の起動に失敗しました。");
    console.error(`  error: ${result.error.message}`);
    if (isWindows) {
      console.error("  Windows 対処のヒント:");
      console.error("   - Node.js を 18.20.2 / 20.12.2 / 21.7.3 以降にしてください。");
      console.error("   - shell: true 必須（CVE-2024-27980 対策）。本スクリプトは対応済み。");
      console.error("   - WebView2 ランタイムが入っていない場合は MS から導入してください。");
      console.error("   - Rust toolchain (cargo / rustc) が PATH にあるか確認してください。");
    }
    return 1;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    console.error(`[tauri-build] Tauri ビルドが失敗しました (exit code ${result.status})`);
    return result.status;
  }

  // result.status が null（シグナル終了など）の場合も失敗扱い
  return typeof result.status === "number" ? result.status : 1;
}

function buildMac() {
  if (!isMac) {
    console.error("[tauri-build] macOS 向けビルドは macOS 環境で実行してください。");
    console.error(`  現在のプラットフォーム: ${platform}`);
    return 1;
  }

  // 限定ベータ配布では .app と .dmg を同時生成する。
  // hdiutil が使えないCI等で .app のみ確認したい場合は MITRU_BUILD_APP_ONLY=1 を付ける。
  const bundles = process.env.MITRU_BUILD_APP_ONLY === "1" ? "app" : "app,dmg";
  console.log(`[tauri-build] macOS ビルドを開始します (bundles=${bundles})`);
  return runTauri(["build", "--bundles", bundles]);
}

function buildWindows() {
  if (!isWindows) {
    console.error("❌ Windows向けビルドはWindows環境で実行してください。");
    process.exit(1);
  }

  console.log("[tauri-build] script-version=2026-05-14 platform=win32");

  const tauriBin = path.join(projectRoot, "node_modules", ".bin", "tauri.cmd");

  console.log("[tauri-build] Windowsビルドを開始します (bundles=nsis,msi)");
  console.log(`[tauri-build] 実行: "${tauriBin}" build --bundles nsis,msi`);

  if (!fs.existsSync(tauriBin)) {
    console.error("❌ Windowsビルド失敗: Tauri CLI のバイナリが見つかりません。");
    console.error(`   期待パス: ${tauriBin}`);
    console.error("   `npm install` を実行してから再度お試しください。");
    return 1;
  }

  try {
    execSync(`"${tauriBin}" build --bundles nsis,msi`, {
      stdio: "inherit",
      shell: true,
      cwd: projectRoot,
      env: process.env,
    });
    console.log("✅ Windowsビルドが完了しました！");
    return 0;
  } catch (error) {
    console.error("❌ Windowsビルド失敗:", error instanceof Error ? error.message : error);
    return 1;
  }
}

let exitCode = 0;

switch (target) {
  case "mac":
    exitCode = buildMac();
    break;
  case "windows":
    exitCode = buildWindows();
    break;
  case "all":
    if (isMac) {
      exitCode = buildMac();
      if (exitCode === 0) {
        console.error("[tauri-build] tauri:build:all はこの環境だけでは完了しません。");
        console.error("  Windows向け NSIS/MSI は Windows 環境で別途実行してください。");
        // 片肺ビルドを「成功」と誤認させないため、敢えて非ゼロで終了する
        exitCode = 1;
      }
    } else if (isWindows) {
      exitCode = buildWindows();
      if (exitCode === 0) {
        console.error("[tauri-build] tauri:build:all はこの環境だけでは完了しません。");
        console.error("  macOS向け .app/.dmg は macOS 環境で別途実行してください。");
        exitCode = 1;
      }
    } else {
      console.error("[tauri-build] 配布ビルドは macOS または Windows 環境で実行してください。");
      console.error(`  現在のプラットフォーム: ${platform}`);
      exitCode = 1;
    }
    break;
  default:
    console.error(`[tauri-build] 未知のターゲット: '${target}'`);
    console.error("  指定可能: mac / windows / all");
    exitCode = 1;
}

process.exit(exitCode);
