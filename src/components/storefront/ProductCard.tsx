import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ProductType } from "@/generated/prisma/enums";
import { pickText, type CatalogListItem } from "@/lib/catalog/types";
import type { SupportedLocale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import { grainedArt } from "@/components/storefront/art";
import { artKeyForSlug } from "@/components/storefront/product-art";
import { TiltCard } from "@/components/motion/TiltCard";
import styles from "./ProductCard.module.css";

export interface ProductCardProps {
  item: CatalogListItem;
}

/**
 * Shared product card — used by the Home featured grid and the Shop grid. Async server
 * component (fetches its own translations/locale) so both callers can just map over items
 * without threading `t`/`locale` through props.
 */
export async function ProductCard({ item }: ProductCardProps) {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations("shop");
  const tCommon = await getTranslations("common");

  const isPaint = item.type === ProductType.PAINTING;
  const soldOut = !item.inStock;
  const onSale = item.oldPrice != null;

  const badge = soldOut
    ? { label: t("card.soldOut"), tone: styles.badgeMuted }
    : onSale
      ? { label: tCommon("saleTag"), tone: styles.badgeSale }
      : isPaint && item.isOriginal
        ? { label: tCommon("originalTag"), tone: styles.badgeInk }
        : null;

  const currency = tCommon("currency");
  const priceText = item.displayPrice == null ? null : `${currency}${item.displayPrice}`;
  const oldPriceText = item.oldPrice == null ? null : `${currency}${item.oldPrice}`;
  const name = pickText(item.name, locale);

  return (
    <TiltCard>
      <Link href={`/product/${item.slug}`} className={cx(styles.card, soldOut && styles.soldOut)}>
        <div
          className={styles.artWrap}
          style={{ backgroundImage: grainedArt(artKeyForSlug(item.slug)) }}
          role="img"
          aria-label={name}
        >
          {isPaint && <div className={styles.frameOverlay} aria-hidden="true" />}
          {badge && <span className={cx(styles.badge, badge.tone)}>{badge.label}</span>}
        </div>
        <div className={styles.info}>
          <div className={styles.name}>{name}</div>
          <div className={styles.metaRow}>
            {!isPaint &&
              item.colors.map((c) => (
                <span
                  key={c.code}
                  className={styles.dot}
                  style={{ background: c.hex }}
                  title={pickText(c.name, locale)}
                />
              ))}
            {isPaint && (
              <span className={styles.meta}>
                {item.isOriginal ? t("card.originalPrints") : t("card.finePrints")}
              </span>
            )}
          </div>
          <div className={styles.priceRow}>
            {priceText ? (
              <span className={styles.price}>
                {isPaint && <span>{t("card.fromPrefix")}</span>}
                <span dir="ltr">{priceText}</span>
              </span>
            ) : (
              <span className={styles.manualPrice}>{tCommon("manualPrice")}</span>
            )}
            {oldPriceText && (
              <span className={styles.oldPrice} dir="ltr">
                {oldPriceText}
              </span>
            )}
          </div>
        </div>
      </Link>
    </TiltCard>
  );
}
