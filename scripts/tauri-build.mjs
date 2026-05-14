import { spawnSync } from "node:child_process";

const target = process.argv[2] ?? "current";
const platform = process.platform;
const npmCommand = platform === "win32" ? "npm.cmd" : "npm";

const runTauriBuild = (bundles) => {
  const result = spawnSync(
    npmCommand,
    ["exec", "tauri", "--", "build", "--bundles", bundles],
    { stdio: "inherit" },
  );

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exitCode = result.status ?? 1;
};

const buildMac = () => {
  if (platform !== "darwin") {
    console.error("macOS向けビルドはmacOS環境で実行してください。");
    process.exit(1);
  }

  // 限定ベータ配布では、macOS向けに.appと.dmgを同時に生成する。
  // hdiutilが使えないCI等で.appのみ確認したい場合は MITRU_BUILD_APP_ONLY=1 を付ける。
  runTauriBuild(process.env.MITRU_BUILD_APP_ONLY === "1" ? "app" : "app,dmg");
};

const buildWindows = () => {
  if (platform !== "win32") {
    console.error("Windows向けNSIS/MSIビルドはWindows環境またはWindows CIで実行してください。");
    process.exit(1);
  }

  runTauriBuild("nsis,msi");
};

switch (target) {
  case "mac":
    buildMac();
    break;
  case "windows":
    buildWindows();
    break;
  case "all":
    if (platform === "darwin") {
      buildMac();
      if (process.exitCode && process.exitCode !== 0) {
        break;
      }
      console.error("tauri:build:all はこの環境だけでは完了できません。Windows向けNSIS/MSIはWindows環境またはWindows CIで実行してください。");
      process.exit(1);
    } else if (platform === "win32") {
      buildWindows();
      if (process.exitCode && process.exitCode !== 0) {
        break;
      }
      console.error("tauri:build:all はこの環境だけでは完了できません。macOS向け.app/.dmgはmacOS環境で実行してください。");
      process.exit(1);
    } else {
      console.error("Mitruの配布ビルドはmacOSまたはWindows環境で実行してください。");
      process.exit(1);
    }
    break;
  default:
    console.error(`Unknown build target: ${target}`);
    process.exit(1);
}
