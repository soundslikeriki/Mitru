# Mitru 配布ビルド手順

MitruはTauri 2で、macOSとWindows向けに配布できる設定にしている。

## 共通設定

- 製品名: `Mitru`
- バージョン: `0.9.6-beta`
- Bundle ID: `com.mitru.desktop`
- 保存先: `src-tauri/target/release/bundle/`
- アイコン: `src-tauri/icons/mitru-official-mark.png` から `npm run tauri:icon` で生成した公式ロゴアイコンを使用

## macOS

macOSでは標準で `.app` と `.dmg` を生成する。

```bash
npm run tauri:build:mac
```

CIなどで `.app` のみを確認したい場合は、以下のように実行する。

```bash
MITRU_BUILD_APP_ONLY=1 npm run tauri:build:mac
```

成果物:

- `src-tauri/target/release/bundle/macos/Mitru.app`
- `src-tauri/target/release/bundle/dmg/Mitru_0.9.6-beta_*.dmg`

注意:

- `.dmg` 作成にはmacOSの `hdiutil` が必要。
- CodexやCIなど仮想化環境では `hdiutil: create failed - Device not configured` が出る場合がある。その場合は実機MacまたはmacOS CIで再実行する。
- Apple Developer ID署名と公証は、ベータ外部配布前に別途設定する。

### macOSで初回起動できない場合

限定ベータ版はコード署名・公証前の配布になる場合がある。macOSで「開発元を確認できないため開けません」と表示された場合は、以下の手順で起動する。

1. Finderで `Mitru.app` を表示する。
2. `Mitru.app` を右クリックする。
3. 「開く」を選択する。
4. 確認ダイアログでもう一度「開く」を選択する。

通常のダブルクリックではなく、右クリックからの「開く」を使う点を配布案内にも明記する。

## Windows

WindowsではNSIS `.exe` インストーラーと `.msi` を生成する。

```bash
npm run tauri:build:windows
```

成果物:

- `src-tauri/target/release/bundle/nsis/*.exe`
- `src-tauri/target/release/bundle/msi/*.msi`

注意:

- Windows向けビルドはWindows環境またはWindows向けCIで実行する。
- NSISは `currentUser` インストールにしているため、標準では管理者権限なしでインストールできる。
- スタートメニューには `Mitru` フォルダとして登録される。
- インストール先はNSISインストーラー内でユーザーが確認・変更できる想定。
- WebView2は `downloadBootstrapper` を使用し、必要な環境ではインストーラーが取得する。
- コード署名証明書がない場合、Windows SmartScreenの警告が出る可能性がある。

### WindowsでSmartScreen警告が出た場合

限定ベータ版では、コード署名の状態によってWindows SmartScreenの警告が表示される場合がある。配布元を確認したうえで、以下の手順を案内する。

1. SmartScreen警告画面で「詳細情報」をクリックする。
2. 表示された「実行」ボタンをクリックする。

配布案内では、必ずMitruの正式な限定ベータ配布ページから入手したファイルだけを実行するよう明記する。

### Windowsビルド手順

1. Windows 10/11環境を用意する。
2. Node.js、Rust、Tauri CLI、NSIS、WiX Toolsetをインストールする。
3. 依存関係を入れる。

```bash
npm install
```

4. 通常のWebビルドが通ることを確認する。

```bash
npm run build
```

5. NSIS `.exe` と MSI `.msi` を作成する。

```bash
npm run tauri:build:windows
```

6. 生成物を確認する。

```text
src-tauri/target/release/bundle/nsis/
src-tauri/target/release/bundle/msi/
```

Windows配布前に確認すること:

- 初回起動できる
- 保存ダイアログでPDF/CSV/JSONを保存できる
- WebView2未導入環境でインストーラーが案内できる
- 画面スケール125%/150%でテーブルと印刷プレビューが崩れない
- コード署名なしの場合にSmartScreen警告が出ることを配布案内に明記する

## バックアップ推奨

Mitruはローカルファーストのため、案件・顧客・書類・マスタなどのデータは基本的に端末内に保存される。限定ベータでは、以下のタイミングで必ずバックアップを作成することを案内する。

- アプリをアップデートする前
- 実案件を入力する前
- 端末移行やOSアップデートの前
- 不具合報告のためにデータをリセットする前

バックアップはアプリ内の「アプリ設定 > データ出力」から作成する。

## 全ターゲット指定

現在のOSで配布ビルドを実行し、別OS向けの手順も案内する場合:

```bash
npm run tauri:build:all
```

ただし、実際に生成できる成果物は実行OSとビルド環境に依存する。通常はmacOSでは `tauri:build:mac`、Windowsでは `tauri:build:windows` を使う。

## アイコン再生成

正式アイコンを差し替える場合は `src-tauri/icon.svg` または高解像度PNGを用意して、以下を実行する。

```bash
npm run tauri:icon
```

生成・確認する主なファイル:

- `src-tauri/icons/icon.icns`
- `src-tauri/icons/icon.ico`
- `src-tauri/icons/icon.png`
- `src-tauri/icons/ios/AppIcon-512@2x.png`
- `src-tauri/icons/32x32.png`
- `src-tauri/icons/128x128.png`
- `src-tauri/icons/128x128@2x.png`

現在の公式ロゴアイコンは以下の状態を確認済み:

- `icon.icns`: macOS用ICNS
- `icon.ico`: Windows用ICO
- `icon.png`: 512 x 512 PNG
- `ios/AppIcon-512@2x.png`: 1024 x 1024 PNG

Tauri CLIは `icon.png` を標準サイズで生成する。1024pxの確認用PNGは `ios/AppIcon-512@2x.png` として生成される。

## クロスプラットフォーム確認項目

- ファイル保存ダイアログでPDF、CSV、JSONを保存できる
- 保存先にデスクトップ、ドキュメント、ダウンロードを選べる
- 日本語フォントが見積書、請求書、レポートで崩れない
- 画面スケール125%や150%でもサイドバー、テーブル、印刷プレビューが破綻しない
- ライトモード、ダークモード、システム連動が両OSで切り替わる
