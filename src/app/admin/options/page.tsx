import { prisma } from "@/lib/prisma";
import { AdminRole, SizeScope } from "@/generated/prisma/enums";
import { requireAdminPage } from "../_lib/require";
import { createTranslator, getAdminLocale, getAdminMessages } from "../_lib/messages";
import { SizesCard, type SizeRow } from "./SizesCard";
import { FramesCard, type FrameRow } from "./FramesCard";
import { ColorsCard, type ColorRow } from "./ColorsCard";
import { MaterialsMethodsCard, type MaterialRow, type MethodRow } from "./MaterialsMethodsCard";
import pageStyles from "../admin.module.css";
import styles from "./options.module.css";

export default async function AdminOptionsPage() {
  await requireAdminPage(AdminRole.ADMIN);
  const locale = await getAdminLocale();

  let shirtSizes: SizeRow[] = [];
  let paintingSizes: SizeRow[] = [];
  let frames: FrameRow[] = [];
  let colors: ColorRow[] = [];
  let materials: MaterialRow[] = [];
  let methods: MethodRow[] = [];
  let loadError = false;

  try {
    const [sizes, frameRows, colorRows, materialRows, methodRows] = await Promise.all([
      prisma.size.findMany({ orderBy: [{ scope: "asc" }, { sortOrder: "asc" }] }),
      prisma.frame.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.color.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.material.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.productionMethod.findMany({ orderBy: [{ scope: "asc" }, { sortOrder: "asc" }] }),
    ]);

    shirtSizes = sizes
      .filter((s) => s.scope === SizeScope.SHIRT)
      .map((s) => ({ id: s.id, code: s.code, labelAr: s.labelAr, labelEn: s.labelEn, active: s.active }));
    paintingSizes = sizes
      .filter((s) => s.scope === SizeScope.PAINTING)
      .map((s) => ({ id: s.id, code: s.code, labelAr: s.labelAr, labelEn: s.labelEn, active: s.active }));
    frames = frameRows.map((f) => ({
      id: f.id,
      labelAr: f.labelAr,
      labelEn: f.labelEn,
      add: Number(f.add),
      active: f.active,
    }));
    colors = colorRows.map((c) => ({
      id: c.id,
      code: c.code,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      hex: c.hex,
      active: c.active,
    }));
    materials = materialRows.map((m) => ({ id: m.id, labelAr: m.labelAr, labelEn: m.labelEn, active: m.active }));
    methods = methodRows.map((m) => ({
      id: m.id,
      scope: m.scope,
      labelAr: m.labelAr,
      labelEn: m.labelEn,
      active: m.active,
    }));
  } catch (err) {
    console.error("AdminOptionsPage: failed to load options", err);
    loadError = true;
  }

  if (loadError) {
    const t = createTranslator(await getAdminMessages(locale), "adminCommon");
    return (
      <div className={pageStyles.page}>
        <div style={{ textAlign: "center", color: "#8A8070", fontSize: 13, padding: 40 }}>{t("errorGeneric")}</div>
      </div>
    );
  }

  return (
    <div className={pageStyles.page}>
      <div className={styles.grid}>
        <SizesCard scope={SizeScope.SHIRT} rows={shirtSizes} />
        <SizesCard scope={SizeScope.PAINTING} rows={paintingSizes} />
        <FramesCard rows={frames} />
        <ColorsCard rows={colors} />
        <MaterialsMethodsCard materials={materials} methods={methods} />
      </div>
    </div>
  );
}
