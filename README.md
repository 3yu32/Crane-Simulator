# 3D Crane Game — Web クレーンゲームシミュレーター

ブラウザ上で動作する、橋渡し設定の 3D クレーンゲームシミュレーターです。
景品・2 本爪・棒の接触／摩擦／重力／回転／滑りを **Rapier 物理エンジン** で
実際にシミュレーションしています（見た目だけのアニメーションではありません）。

現状は **MVP**：3D シーンの表示、橋渡しの棒の上に静止する景品、2 本爪、
`右 → 奥 → 下降 → 爪を閉じる → 上昇 → 初期位置へ復帰` の一連の自動シーケンス、
物理接触による景品の把持・落下、Reset、Debug パネルまで動作します。

---

## 1. プロジェクト概要

- 橋渡し（4 本の平行な棒、左右の壁いっぱいまで横向きに延びる）の上に縦長の箱型景品が乗っている
- プレイヤーは「右」「奥」の 2 ボタンでクレーンの X / Z 位置を決める
- 位置確定後、クレーンが自動で下降 → 爪を閉じる → 上昇 → ホームへ戻る → 爪を開く
- 景品は爪へ強制追従させず、**爪との接触・摩擦だけ**で持ち上がる
  （掴みが甘ければ途中で滑り落ちる ＝ 正常な挙動）
- 景品が棒から落ちて機体内の床に乗れば（床全体が獲得口）`PRIZE GET!`

## 2. 使用技術

| 技術 | 用途 |
| --- | --- |
| Vite + React + TypeScript | アプリ基盤 |
| Three.js / @react-three/fiber | 3D レンダリング |
| @react-three/drei | OrbitControls など補助 |
| @react-three/rapier / Rapier3D | 剛体・コライダー・ジョイント・モーターの物理演算 |
| leva | Debug / チューニング GUI |
| Vitest | State Machine と取得判定の unit test |

追加ライブラリの導入理由：

- **leva** … 物理パラメータをブラウザ上でリアルタイムに調整するため（spec §20）。
- **vitest** … Vite プロジェクトと親和性が高く、State Machine の純粋関数テストに使用（spec §35）。

## 3. インストール方法

```bash
npm install
```

Node.js 20 以上を推奨。

## 4. 起動方法

```bash
npm run dev       # 開発サーバ (http://localhost:5173)
npm run build     # 本番ビルド (tsc + vite build)
npm run preview   # ビルド結果をプレビュー
npm test          # unit test
npm run lint      # oxlint
```

## 5. 操作方法

| 操作 | 内容 |
| --- | --- |
| **右** ボタンを押している間 | クレーンが +X（右）へ移動。離すと X 位置を確定し、ボタンは無効化 |
| **奥** ボタンを押している間 | クレーンがキャビネット奥へ移動。離すと Z 位置を確定し、自動シーケンス開始 |
| **橋の棒をドラッグ** | 棒を 1 本ずつ動かせる。縦ドラッグ＝高さ、横ドラッグ＝奥行（Z）。向きは固定・間隔は不均等でも可 |
| **RESET** | 景品・爪・ゲーム状態を初期化（リロード不要。ARM／橋／景品サイズの設定は保持） |
| **DEBUG**（右上）または URL に `?debug` | Debug モードの ON/OFF |

ボタンは `pointerdown / pointerup` で実装しており、マウス・タッチ両方で動作します。

### PRIZE SIZE パネル（画面右上・常時表示）

景品の 幅 / 高さ / 奥行 をスライダーで変更（コライダーごと作り直し）。

### ARM パネル（画面左上・常時表示）

デバッグモードとは別に、ゲーム画面上でいつでも調整できます：

| スライダー | 対応パラメータ | 内容 |
| --- | --- | --- |
| **アームパワー** | `claw.motorStiffness` | 爪モーターの強さ（掴む力・閉じる力）。20〜1200 |
| **下降リミット (Y)** | `crane.lowestY` | 爪ハブが下降できる最下点（ハード制限）。1.2〜2.8 |
| **下降停止 張力 (N)** | `crane.descentTensionStop` | 下降中に糸の張力がこの値を下回ったら停止（爪が景品・棒に乗って糸がたるんだ状態）。0〜30 |

パネル下部に「糸の張力」の実測値をリアルタイム表示します（吊り下げ時 ≈ 15 N、着地で 0 付近へ）。

Debug モード（leva パネル）ではさらに以下を調整できます：

- Prize: mass / friction （幅/高さ/奥行は右上 PRIZE SIZE パネル）
- Bridge: rod friction （高さ/間隔は棒のドラッグ）
- Claw: open angle / closed angle / friction
- Crane: X speed / Z speed / descent speed
- `Show Physics Colliders`（コライダーのワイヤーフレーム表示）
- `Orbit Camera`（固定カメラの代わりに OrbitControls）
- 現在の State Machine の状態表示

（アームパワー／下降リミット／下降停止 張力は上記「ARM パネル」で常時調整可能）

## 6. ディレクトリ構成

```
src/
├── config/
│   └── gameConfig.ts          物理パラメータの一元管理（spec §19）
├── physics/
│   └── collisionGroups.ts     クレーン／爪の衝突フィルタ
├── game/
│   ├── craneStateMachine.ts   純粋な有限状態機械（spec §14, §29）
│   ├── craneStateMachine.test.ts
│   ├── gameStore.ts           React UI と物理ループ間の外部ストア
│   ├── useCraneController.ts  固定タイムステップでクレーンを駆動
│   ├── prizeDetection.ts      取得判定（spec §27）
│   ├── prizeDetection.test.ts
│   └── useDebugConfig.ts      gameConfig ＋ ARM パネル ＋ leva GUI を合成
├── components/
│   ├── GameScene.tsx          カメラ・ライト・物理ワールドの組み立て
│   ├── Crane/
│   │   ├── Crane.tsx          リグの組み立て（Carriage/Hub/Cable/ClawAssembly）
│   │   ├── Carriage.tsx       キネマティックなトロリー（X/Z のみ移動）
│   │   ├── Hub.tsx            糸で吊られた dynamic な爪ハブ
│   │   ├── Cable.tsx          糸の見た目（carriage↔hub 追従）
│   │   ├── ClawAssembly.tsx   2 本爪 ＋ Revolute Joint ＋ モーター
│   │   └── Claw.tsx           1 本の爪（アーム＋爪先の複合コライダー）
│   ├── Prize/Prize.tsx        Dynamic RigidBody ＋ Cuboid Collider
│   ├── Bridge/
│   │   ├── Bridge.tsx         横向き 4 本の棒 ＋ 1 本ずつのドラッグ処理
│   │   └── Rod.tsx            Fixed RigidBody ＋ Cylinder Collider
│   ├── Environment/
│   │   ├── Cabinet.tsx        床（一枚板）・壁・枠
│   │   └── GoalMarker.tsx     獲得領域の可視化（Debug 時のみ）
│   ├── SideView.tsx           左パネル下の横アングル インセット表示
│   ├── Controls/
│   │   ├── CraneControls.tsx  右／奥／RESET ボタン
│   │   ├── ArmControls.tsx    画面左上の ARM スライダー（常時表示）
│   │   └── PrizeControls.tsx  画面右上の 景品サイズ スライダー
│   └── Debug/DebugPanel.tsx
├── App.tsx
└── main.tsx
```

## 7. 物理モデルの説明

| 要素 | 剛体タイプ | コライダー | 補足 |
| --- | --- | --- | --- |
| 棒（×4） | **kinematicPosition** | Cylinder | X 方向（横向き）に壁から壁まで。1 本ずつドラッグで高さ / 奥行(Z) を変更（`bridgeControls.rods`）|
| 景品 | **dynamic** | Cuboid | 回転ロックなし。CCD 有効。摩擦・質量・damping すべて設定可 |
| トロリー（carriage） | **kinematicPosition** | Cuboid | 実機の X/Z モーター相当。Y は固定。毎ステップ `setNextKinematicTranslation` |
| 爪ハブ（hub） | **dynamic** | Cuboid | 回転ロック。糸（下記）で吊られ、上下は物理で決まる |
| 爪（×2） | **dynamic** | アーム＋爪先の 2 Cuboid | Hub と Revolute Joint で接続 |
| 床・壁・枠 | fixed | Cuboid | 床は穴なしの一枚板。床全体が獲得判定領域 |

- **上下動＝糸巻き（winch）** … 爪ハブはトロリーから **Y 軸 Prismatic Joint** で吊られ、
  その **position motor**（ForceBased）が糸の巻き上げ／繰り出しです。目標長を毎ステップ
  更新することでハブが上下します。Prismatic の limit で `[lowestY, topY]` の範囲外へは出ません。
- **下降停止（糸のたるみ検出）** … Rapier の JS 版はジョイント反力を取得できないため、
  張力はキネマティックに推定します：ハブが巻き出し速度に追従している間は「糸は張っていて
  吊り荷重（≈ 15 N）を保持」、爪が景品・棒に乗ってハブが追従しなくなると張力は 0 付近へ低下。
  数フレーム連続で `descentTensionStop` を下回ったら下降を停止します（spec §15）。
- **爪の開閉** … `Revolute Joint` ＋ `configureMotorPosition`（AccelerationBased）。
  モーターは「無限に強くない」ため、景品が爪の間にあるとモーター力 vs 景品の抵抗で
  完全には閉じきらず、強く掴む／弱く掴む／途中で滑る、が自然に発生します（spec §9）。
- **把持** … 景品を爪の子にしたり座標を強制代入したりはしていません（spec §31）。
  景品が持ち上がるのは 2 本の爪との接触力・摩擦のみによります。移動中に滑り落ちるのも正常。
- **衝突フィルタ** … Hub と爪はジョイントで重なるため相互に衝突させません
  （させると接触ソルバがモーターと競合して爪が動かなくなる）。爪同士・爪と世界は衝突します。
- **固定タイムステップ** … `Physics timeStep = 1/60`、solver iterations = 8。
  クレーンの状態遷移・移動は `useBeforePhysicsStep` 内で固定 dt により処理し、描画 FPS から分離。

### 座標系（spec §4）

`+X = 右`, `+Y = 上`, `+Z = 奥`。

実装ではプレイ用カメラを +Z 側（手前）に置き、画面上で `+X = 右` になる一般的な
右手系の構成にしています。そのためゲーム内では **Z が小さくなる向き＝キャビネットの奥**
として扱っています（`crane.minZ` が最奥、`homeZ` が手前）。config のフィールド名は
spec のまま変更していません。

## 8. 主要な物理パラメータ（`src/config/gameConfig.ts` 初期値）

| パラメータ | 値 | 意味 |
| --- | --- | --- |
| `gravity` | -9.81 | 重力 |
| `physics.timeStep` | 1/60 | 固定タイムステップ |
| `crane.xSpeed / zSpeed` | 1.3 / 1.1 | 水平移動速度 (m/s) |
| `crane.descentSpeed / liftSpeed` | 0.6 / 0.55 | 下降・上昇速度 (m/s) |
| `crane.returnSpeed` | 0.9 | ホーム復帰速度 (m/s) |
| `crane.carriageY` | 3.55 | トロリー（糸の吊り元）の固定 Y |
| `crane.lowestY / topY` | 1.66 / 3.0 | 爪ハブの Y 可動域（＝Descent Limit Y） |
| `crane.cableStiffness / cableDamping` | 220 / 20 | 糸巻きモーター（ForceBased）の剛性・減衰 |
| `crane.hubMass` | 0.9 | 爪ハブの質量 |
| `crane.descentTensionStop` | 6 | 糸の張力 (N) がこれを下回ると下降停止（spec §15） |
| `goal.center / halfExtents` | 床全体 | 景品がこの薄いスラブ（床直上）に入れば獲得 |
| `claw.openAngle / closedAngle` | 0.30 / 0.66 rad | 爪モーターの目標角（開／閉） |
| `claw.motorStiffness / motorDamping` | 420 / 42 | 爪モーターの剛性・減衰（＝Arm Power／掴む強さ） |
| `claw.friction` | 3.0 | 爪の摩擦係数 |
| `claw.pivotSpan` | 0.48 | 2 つの支点間の距離（景品幅より広く、下降時に干渉しない） |
| `prize.width / height / depth` | 0.30 / 0.58 / 0.30 | 景品サイズ |
| `prize.mass` | 0.34 | 景品の質量 |
| `prize.friction` | 1.3 | 景品の摩擦係数 |
| `bridge.rodCount / rodSpacing` | 4 / 0.24 | 棒の本数と Z 方向の間隔（広げると景品が間に落ちる） |
| `bridge.rodLength` | 3.9 | 棒の長さ（左壁〜右壁） |
| `bridge.friction` | 0.5 | 棒の摩擦係数 |

## 9. パラメータ調整方法

1. `npm run dev` で起動し、`DEBUG` ボタン（または `?debug`）で Debug モードへ。
2. leva パネルのスライダーで値を変更。景品・棒・爪など形状／質量に関わる値は
   その場で該当ボディが再マウントされます。`Show Physics Colliders` で当たり判定を確認。
3. 良い値が決まったら `src/config/gameConfig.ts` の初期値へ反映。

## 10. 今後改善できる箇所

- **把持の安定性** … 現状、爪が景品を掴んで持ち上げ床へ落とせることはあるが、
  下降・閉爪時に景品を弾いてしまう場合や、上昇・復帰中に滑り落ちる場合がある。
  `claw.motorStiffness` / `claw.friction` / `prize.friction` / `closedAngle` /
  閉爪速度のさらなるチューニングで成功率を上げられる。
- `prize.centerOfMass` は config にあるが未接続（`massProperties` へ配線が必要）。
- 爪モーターの「max impulse」は Rapier JS バインディングに直接 API が無いため、
  現状は stiffness で近似。将来的に `setMotorMaxForce` 相当が入れば置き換え可能。
- GLTF モデルへの差し替え（現状は primitive geometry のみ）。
- 下降停止は糸の張力しきい値（`descentTensionStop`）で対応済み。ただし張力は Rapier の
  制約反力ではなくキネマティック推定（ハブの追従速度ベース）。Rapier に反力取得 API が
  入れば実測へ置換したい。景品を綺麗にまたいで下降する配置では接触が起きず最下点まで下降する。
- サウンド、コイン、演出など。

## 11. テスト

```bash
npm test
```

- `craneStateMachine.test.ts` … `IDLE → MOVING_X → WAITING_Z → MOVING_Z → OPENING →
  DESCENDING → CLOSING → LIFTING → RETURNING → RELEASING → IDLE` の正常遷移、
  無効イベントのガード、RESET、ボタン活性状態を検証。
- `prizeDetection.test.ts` … Goal 領域の内外判定。

物理挙動は Debug モードでコライダー表示・OrbitControls を使って確認します。

## 現時点での制限事項

- 把持の成功は毎回保証されない（物理タイミング依存。仕様上、滑り落ちも正常挙動）。
- `prize.centerOfMass` 未接続。
- 本番バンドルが大きい（Three.js + Rapier wasm、約 1.2MB gzip）。コード分割は未実施。
- `import.meta.env.DEV` 時のみ `window.__sim` / `window.__gameStore` など
  デバッグ用フックを露出（本番ビルドでは除去）。
