# Mitru

Mitru（ミトル）は、工務店・建築業者向けのローカルファースト見積もり・積算デスクトップアプリです。Tauri + React + TypeScript で構築し、案件、積算、見積書、請求書、マスタ、会社情報、バックアップをオフラインで扱えます。

現在のベータ版は `v0.9.6-beta` です。初回起動時は、粗利率の違う実務向けサンプル案件を読み込んで主要機能を試せます。

Mitruは、Goolipのローカル代替として開発中の限定ベータ版です。現場での使いやすさ、積算のしやすさ、書類作成フローについてフィードバックを積極的に募集しています。

## 初回起動時の注意事項

限定ベータ版はコード署名・公証・ストア配布の準備前で配布する場合があります。そのため、OS側の保護機能により初回起動時に警告が表示されることがあります。

### macOS

macOSで「開発元を確認できないため開けません」と表示された場合:

1. Finderで `Mitru.app` を開く場所まで移動します。
2. `Mitru.app` を右クリックします。
3. 「開く」を選びます。
4. 表示された確認ダイアログでもう一度「開く」を選びます。

通常のダブルクリックでは開けない場合でも、右クリックからの「開く」で許可できることがあります。

### Windows

WindowsでSmartScreenの警告が表示された場合:

1. 警告画面の「詳細情報」をクリックします。
2. 表示された「実行」ボタンをクリックします。

コード署名なしの限定ベータではSmartScreen警告が出る可能性があります。配布元がMitruの限定ベータ配布ページであることを確認してから実行してください。

### バックアップ推奨

Mitruはローカルファースト設計のため、入力したデータは基本的に端末内に保存されます。限定ベータでは、アップデート前、端末移行前、実案件の入力前、データリセット前に、必ず「アプリ設定 > データ出力」から控えを作成してください。

特に実案件を入力する場合は、作業開始前と作業終了後の両方でバックアップを作成することを推奨します。

## 開発

```bash
npm install
npm run tauri:dev
```

ブラウザだけで確認する場合:

```bash
npm run dev
```

## 本番ビルド

現在のOS向けの配布物を生成します。

```bash
npm run tauri build
```

同じコマンドを短縮名で実行することもできます。

```bash
npm run tauri:build
```

macOS向けに `.app` と `.dmg` を作成する場合:

```bash
npm run tauri:build:mac
```

CIなどで `.app` だけを確認したい場合:

```bash
MITRU_BUILD_APP_ONLY=1 npm run tauri:build:mac
```

Windows向けにNSIS `.exe` インストーラーと `.msi` を作成する場合:

```bash
npm run tauri:build:windows
```

現在のOSで配布ビルドを実行し、別OS向けの手順も案内する場合:

```bash
npm run tauri:build:all
```

WindowsインストーラーはWindows環境またはWindows向けCIでビルドしてください。macOSから直接Windows用 `.exe` / `.msi` を生成する構成ではありません。

別OS向けのビルドコマンドを誤った環境で実行した場合は、明確にエラー終了します。macOS版はmacOSで、Windows版はWindowsまたはWindows CIで生成してください。

生成物は `src-tauri/target/release/bundle/` に出力されます。

## 配布方法

Tauriはビルドを実行したOS向けの配布物を生成します。

| OS | 主な成果物 | 備考 |
| --- | --- | --- |
| macOS | `.dmg`, `.app` | Apple Developer ID署名・公証はリリース前に別途設定 |
| Windows | `.exe`, `.msi` | Windows環境またはCIでビルド |
| Linux | `.AppImage`, `.deb`, `.rpm` | Linux環境またはCIでビルド |

アップデート配信、自動更新、コード署名、ストア公開設定は今後のリリース工程で追加します。

## アイコン

公式ロゴ元データは `src-tauri/icons/mitru-official-mark.png` です。Tauri用アイコンは以下で再生成できます。

```bash
npm run tauri:icon
```

生成済みアイコンは `src-tauri/icons/` に配置されています。

最低限必要なアイコンは以下です。現在はMitru公式ロゴから生成済みのものを参照しています。

- `src-tauri/icons/icon.icns`: macOS用
- `src-tauri/icons/icon.ico`: Windows用
- `src-tauri/icons/icon.png`: Tauri標準PNG
- `src-tauri/icons/ios/AppIcon-512@2x.png`: 1024x1024 PNG

正式ロゴへ差し替える場合は、1024x1024以上の正方形PNGまたはSVGを用意し、`npm run tauri:icon` で再生成してください。

## 環境変数

`.env.example` を参考にしてください。Mitruは標準設定ではサーバーや外部APIを必要としません。

## 注意事項

- 現在のベータ版では、データはZustand + localStorageで端末内に保存します。SQLite永続化は未使用です。
- 重要データは、アプリ設定のデータ出力機能やPDF出力を使って定期的に控えを残してください。
- PDF出力はロゴ、社印、背景画像をローカルデータとして扱います。
- 本番配布前に、各OS上で実機起動、PDF出力、バックアップ復元を確認してください。

## ベータ版としての注意事項

- `v0.9.6-beta` は実運用前の検証版です。重要な案件を入力する前に、サンプルデータで積算、見積、請求、入金、発注、支払、レポートの流れを確認してください。
- MitruはGoolipのローカル代替として開発中です。既存業務から置き換える前に、実際の案件データに近い検証データで動作を確認してください。
- データは端末内に保存されます。ブラウザプロファイルやアプリデータを削除するとデータも消える可能性があります。
- アップデート前、端末移行前、長時間の入力作業前には、必ず「アプリ設定 > データ出力」からCSV/PDF/JSONの控えを作成してください。
- PDF、CSV、JSON出力はOSの保存ダイアログを使います。保存先フォルダの権限がない場合は、デスクトップや書類フォルダなど書き込み可能な場所を選んでください。
- 保存データが大きくなると、アプリ内でバックアップ推奨の警告を表示します。警告が出た場合は、不要な画像や古い検証データを整理し、データ出力で控えを作成してください。
- 限定ベータ期間中は、使いにくい操作、足りない工事項目、見積書・請求書の見た目、計算結果の違和感などのフィードバックを歓迎します。

## ベータ公開前チェック

最終確認項目は [docs/beta-release-final-test-checklist.md](docs/beta-release-final-test-checklist.md) にまとめています。

大量データの集計負荷確認は以下で実行できます。

```bash
npm run test:beta-load
```

macOS/Windows配布の手順は [docs/distribution.md](docs/distribution.md) にまとめています。
