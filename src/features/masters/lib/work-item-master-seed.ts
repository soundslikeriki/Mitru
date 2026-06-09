import { defaultInteriorWorkItemMasterInputs, systemWorkMasterCategories } from "@/stores/defaults";
import {
  type WorkItemMaster,
  type WorkItemMasterInput,
  useProjectStore,
} from "@/stores/project-store";

const workItemMastersInitializedKey = "mitru-work-item-masters-initialized-v1";
const workItemMastersUserManagedKey = "mitru-work-item-masters-user-managed-v1";

export const workMasterCategoryOrder = systemWorkMasterCategories;

const interiorWorkItemMasterInputs: WorkItemMasterInput[] = defaultInteriorWorkItemMasterInputs;

const temporaryWorkItemMasterInputs: WorkItemMasterInput[] = [
  workMasterInput("仮設足場", "仮設足場", "仮設工事"),
  workMasterInput("養生", "養生", "仮設工事"),
  workMasterInput("仮設電気", "仮設電気", "仮設工事"),
  workMasterInput("仮設水道", "仮設水道", "仮設工事"),
  workMasterInput("仮設トイレ", "仮設トイレ", "仮設工事"),
];

const woodWorkItemMasterInputs: WorkItemMasterInput[] = [
  workMasterInput("大工工事", "大工工事", "木工事"),
  workMasterInput("造作工事", "造作工事", "木工事"),
  workMasterInput("床下地", "床下地", "木工事"),
  workMasterInput("階段工事", "階段工事", "木工事"),
  workMasterInput("枠工事", "枠工事", "木工事"),
  workMasterInput("野縁工事", "野縁工事", "木工事"),
];

const electricalWorkItemMasterInputs: WorkItemMasterInput[] = [
  workMasterInput("照明器具設置", "照明器具設置", "電気工事"),
  workMasterInput("コンセント工事", "コンセント工事", "電気工事"),
  workMasterInput("スイッチ工事", "スイッチ工事", "電気工事"),
  workMasterInput("配線工事", "配線工事", "電気工事"),
  workMasterInput("分電盤工事", "分電盤工事", "電気工事"),
  workMasterInput("スイッチボックス工事", "スイッチボックス工事", "電気工事"),
];

const plumbingWorkItemMasterInputs: WorkItemMasterInput[] = [
  workMasterInput("給水管工事", "給水管工事", "給排水衛生工事"),
  workMasterInput("排水管工事", "排水管工事", "給排水衛生工事"),
  workMasterInput("衛生器具設置", "衛生器具設置", "給排水衛生工事"),
  workMasterInput("給湯器工事", "給湯器工事", "給排水衛生工事"),
  workMasterInput("水栓工事", "水栓工事", "給排水衛生工事"),
  workMasterInput("排水設備工事", "排水設備工事", "給排水衛生工事"),
];

const fixturePlasterTileWorkItemMasterInputs: WorkItemMasterInput[] = [
  workMasterInput("室内ドア取付工事", "室内ドア取付工事", "建具工事"),
  workMasterInput("玄関ドア工事", "玄関ドア工事", "建具工事"),
  workMasterInput("収納建具工事", "収納建具工事", "建具工事"),
  workMasterInput("ガラス建具工事", "ガラス建具工事", "建具工事"),
  workMasterInput("モルタル塗り工事", "モルタル塗り工事", "左官工事"),
  workMasterInput("漆喰工事", "漆喰工事", "左官工事"),
  workMasterInput("珪藻土塗り工事", "珪藻土塗り工事", "左官工事"),
  workMasterInput("下地調整工事", "下地調整工事", "左官工事"),
  workMasterInput("陶磁器質タイル貼り工事", "陶磁器質タイル貼り工事", "タイル工事"),
  workMasterInput("床タイル工事", "床タイル工事", "タイル工事"),
  workMasterInput("壁タイル工事", "壁タイル工事", "タイル工事"),
  workMasterInput("モザイクタイル工事", "モザイクタイル工事", "タイル工事"),
];

const paintWaterproofExteriorWorkItemMasterInputs: WorkItemMasterInput[] = [
  workMasterInput("外壁塗装工事", "外壁塗装工事", "塗装工事"),
  workMasterInput("木部塗装工事", "木部塗装工事", "塗装工事"),
  workMasterInput("鉄部塗装工事", "鉄部塗装工事", "塗装工事"),
  workMasterInput("吹付塗装工事", "吹付塗装工事", "塗装工事"),
  workMasterInput("シート防水工事", "シート防水工事", "防水工事"),
  workMasterInput("ウレタン防水工事", "ウレタン防水工事", "防水工事"),
  workMasterInput("シーリング工事", "シーリング工事", "防水工事"),
  workMasterInput("ブロック積み工事", "ブロック積み工事", "外構工事"),
  workMasterInput("フェンス工事", "フェンス工事", "外構工事"),
  workMasterInput("門扉工事", "門扉工事", "外構工事"),
  workMasterInput("駐車場アスファルト工事", "駐車場アスファルト工事", "外構工事"),
  workMasterInput("土間コンクリート工事", "土間コンクリート工事", "外構工事"),
];

const exteriorFoundationDemolitionWorkItemMasterInputs: WorkItemMasterInput[] = [
  workMasterInput("外壁工事", "外壁工事", "外装工事"),
  workMasterInput("屋根工事", "屋根工事", "外装工事"),
  workMasterInput("サッシ工事", "サッシ工事", "外装工事"),
  workMasterInput("地盤改良工事", "地盤改良工事", "基礎工事"),
  workMasterInput("型枠工事", "型枠工事", "基礎工事"),
  workMasterInput("鉄筋工事", "鉄筋工事", "基礎工事"),
  workMasterInput("コンクリート打設工事", "コンクリート打設工事", "基礎工事"),
  workMasterInput("建物解体工事", "建物解体工事", "解体工事"),
  workMasterInput("内装解体工事", "内装解体工事", "解体工事"),
  workMasterInput("廃材処分工事", "廃材処分工事", "解体工事"),
];

const remainingWorkItemMasterInputs: WorkItemMasterInput[] = [
  workMasterInput("ガス配管工事", "ガス配管工事", "ガス工事"),
  workMasterInput("ガス器具設置工事", "ガス器具設置工事", "ガス工事"),
  workMasterInput("空調設備工事", "空調設備工事", "設備工事"),
  workMasterInput("換気設備工事", "換気設備工事", "設備工事"),
  workMasterInput("消防設備工事", "消防設備工事", "設備工事"),
  workMasterInput("エレベーター設置工事", "エレベーター設置工事", "昇降機工事"),
  workMasterInput("植栽工事", "植栽工事", "造園工事"),
  workMasterInput("芝張り工事", "芝張り工事", "造園工事"),
  workMasterInput("園路工事", "園路工事", "造園工事"),
  workMasterInput("水回りリフォーム工事", "水回りリフォーム工事", "リフォーム工事"),
  workMasterInput("間取り変更工事", "間取り変更工事", "リフォーム工事"),
  workMasterInput("バリアフリー工事", "バリアフリー工事", "リフォーム工事"),
];

const steelWorkItemMasterInputs: WorkItemMasterInput[] = [
  workMasterInput("鉄骨建方工事", "鉄骨建方工事", "鉄骨工事"),
  workMasterInput("溶接工事", "溶接工事", "鉄骨工事"),
  workMasterInput("鉄骨加工工場組立", "鉄骨加工工場組立", "鉄骨工事"),
  workMasterInput("高力ボルト接合工事", "高力ボルト接合工事", "鉄骨工事"),
  workMasterInput("鉄骨下地工事", "鉄骨下地工事", "鉄骨工事"),
];

const otherWorkItemMasterInputs: WorkItemMasterInput[] = [
  workMasterInput("雑工事", "雑工事", "その他"),
  workMasterInput("清掃工事", "清掃工事", "その他"),
  workMasterInput("残材処理工事", "残材処理工事", "その他"),
  workMasterInput("運搬工事", "運搬工事", "その他"),
];

export function getDefaultWorkItemMasterInputs() {
  return [
    ...getDefaultInteriorWorkItemMasterInputs(),
    ...temporaryWorkItemMasterInputs,
    ...woodWorkItemMasterInputs,
    ...electricalWorkItemMasterInputs,
    ...plumbingWorkItemMasterInputs,
    ...fixturePlasterTileWorkItemMasterInputs,
    ...paintWaterproofExteriorWorkItemMasterInputs,
    ...exteriorFoundationDemolitionWorkItemMasterInputs,
    ...remainingWorkItemMasterInputs,
    ...steelWorkItemMasterInputs,
    ...otherWorkItemMasterInputs,
  ];
}

function getDefaultInteriorWorkItemMasterInputs() {
  return interiorWorkItemMasterInputs.map((input, index) => ({ ...input, favorite: index < 6 }));
}

export function repairMissingDefaultWorkItemMasters() {
  const state = useProjectStore.getState();
  const currentMasters = state.workItemMasters;
  const hasInitializedFlag = localStorage.getItem(workItemMastersInitializedKey) === "done";

  if (!hasInitializedFlag || needsDefaultWorkItemMasterRepair(currentMasters)) {
    seedMissingWorkItemMasters(getDefaultWorkItemMasterInputs(), state.createWorkItemMaster);
    localStorage.setItem(workItemMastersInitializedKey, "done");
  }
}

export function markWorkItemMastersUserManaged() {
  localStorage.setItem(workItemMastersUserManagedKey, "done");
}

export function getWorkMasterCategory(master: WorkItemMaster) {
  const major = master.majorCategory.trim();
  const text = `${master.majorCategory} ${master.name}`;
  if (workMasterCategoryOrder.includes(major as (typeof workMasterCategoryOrder)[number]) && major !== "設備工事") return major;

  if (/仮設/.test(major) || /仮設/.test(text)) return "仮設工事";
  if (/基礎/.test(major) || /基礎|土工|根切|捨てコン|配筋|型枠/.test(text)) return "基礎工事";
  if (/鉄骨/.test(major) || /鉄骨|鋼材|溶接/.test(text)) return "鉄骨工事";
  if (/解体|撤去/.test(major) || /解体|撤去|はつり|処分/.test(text)) return "解体工事";
  if (/外装/.test(major) || /外壁|サイディング|屋根|樋|板金/.test(text)) return "外装工事";
  if (/建具/.test(major) || /建具|扉|サッシ|襖|障子/.test(text)) return "建具工事";
  if (/左官/.test(major) || /左官|モルタル|漆喰/.test(text)) return "左官工事";
  if (/タイル/.test(major) || /タイル/.test(text)) return "タイル工事";
  if (/塗装/.test(major) || /塗装|塗り|吹付/.test(text)) return "塗装工事";
  if (/防水/.test(major) || /防水|シーリング|コーキング/.test(text)) return "防水工事";
  if (/電気/.test(major) || /電気|照明|配線|コンセント|分電|弱電/.test(text)) return "電気工事";
  if (/給排水|衛生/.test(major) || /給排水|衛生|配管|水栓|トイレ|洗面|浴室|キッチン/.test(text)) return "給排水衛生工事";
  if (/空調|換気/.test(major) || /空調|換気|エアコン|ダクト|冷媒/.test(text)) return "空調換気工事";
  if (/ガス/.test(major) || /ガス/.test(text)) return "ガス工事";
  if (/昇降機/.test(major) || /昇降機|エレベーター|リフト/.test(text)) return "昇降機工事";
  if (/外構/.test(major) || /外構|舗装|フェンス|門扉|土間|ブロック/.test(text)) return "外構工事";
  if (/造園/.test(major) || /造園|植栽|庭|芝/.test(text)) return "造園工事";
  if (/リフォーム|改修/.test(major) || /リフォーム|改修/.test(text)) return "リフォーム工事";
  if (/木工/.test(major) || /木工|造作|下地|棚|間仕切/.test(text)) return "木工事";
  if (/内装/.test(major) || /内装|ボード|クロス|床|壁|天井|シート|仕上/.test(text)) return "内装工事";
  if (/設備/.test(major)) return "設備工事";
  return "その他";
}

export function needsDefaultWorkItemMasterRepair(masters: WorkItemMaster[]) {
  if (masters.length < 80) return true;

  const categories = new Set(masters.map(getWorkMasterCategory));
  if (categories.size < 3) return true;

  return !workMasterCategoryOrder.some((category) => category !== "内装工事" && categories.has(category));
}

function seedMissingWorkItemMasters(
  inputs: WorkItemMasterInput[],
  createWorkItemMaster: (input: WorkItemMasterInput) => WorkItemMaster,
) {
  inputs.forEach((input) => {
    const currentMasters = useProjectStore.getState().workItemMasters;
    const exists = currentMasters.some((master) => workMasterKey(master) === workMasterKey(input));
    if (!exists) createWorkItemMaster(input);
  });
}

function workMasterInput(itemName: string, name = itemName, majorCategory = "内装工事"): WorkItemMasterInput {
  return {
    majorCategory,
    middleCategory: majorCategory,
    name,
    unit: "式",
    standardLaborProductivity: 0,
    standardLaborUnitCost: 0,
    standardMaterialUnitCost: 0,
    standardExpenseRate: 0,
    note: "",
  };
}

function workMasterKey(master: Pick<WorkItemMasterInput, "majorCategory" | "middleCategory" | "name">) {
  return `${master.majorCategory}|${master.middleCategory}|${master.name}`;
}
