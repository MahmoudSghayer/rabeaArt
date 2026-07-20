import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "../../_lib/require";
import { createTranslator, getAdminLocale, getAdminMessages } from "../../_lib/messages";
import { formatDate, formatMoney } from "@/components/admin/format";
import { avatarColorForId } from "../avatar";
import { CustomerDetailView, type CustomerDetailData } from "./CustomerDetailView";
import pageStyles from "../../admin.module.css";

/** Marker the design's mockup surfaces as a warning chip — see AGENTS.md: "possible-duplicate
 * marker surfaced if customer.notes contains '[system] possible duplicate'". Matched
 * case-insensitively since it's free text an admin (or a future de-dup job) may have typed. */
const POSSIBLE_DUPLICATE_MARKER = "[system] possible duplicate";

/** Joins whichever address fields are present — every field is optional in the schema (mirrors
 * `composeAddress` in `orders/[id]/CustomerCard.tsx`, duplicated locally: that file is owned by a
 * different parallel workstream, see AGENTS.md). */
function composeAddress(customer: {
  street: string | null;
  building: string | null;
  apt: string | null;
  city: string | null;
  country: string | null;
  postal: string | null;
}): string {
  return [customer.street, customer.building, customer.apt, customer.city, customer.country, customer.postal]
    .filter(Boolean)
    .join(", ");
}

async function loadCustomer(
  id: string,
  locale: "ar" | "en",
  afterReviewLabel: string,
): Promise<CustomerDetailData | null> {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        where: { archived: false },
        orderBy: { createdAt: "desc" },
        select: { id: true, ref: true, createdAt: true, status: true, estTotal: true, finalPrice: true },
      },
    },
  });
  if (!customer) return null;

  const lifetimeValue = customer.orders.reduce((sum, o) => {
    const value = o.finalPrice !== null ? Number(o.finalPrice) : o.estTotal !== null ? Number(o.estTotal) : 0;
    return sum + value;
  }, 0);

  return {
    id: customer.id,
    name: customer.name,
    avatarColor: avatarColorForId(customer.id),
    since: formatDate(customer.createdAt, locale),
    phone: customer.phone,
    whatsapp: customer.whatsapp,
    email: customer.email,
    address: composeAddress(customer),
    preferredContact: customer.preferredContact,
    notes: customer.notes ?? "",
    possibleDuplicate: (customer.notes ?? "").toLowerCase().includes(POSSIBLE_DUPLICATE_MARKER),
    orderCount: customer.orders.length,
    lifetimeValue: formatMoney(lifetimeValue, "₪0"),
    orders: customer.orders.map((o) => ({
      id: o.id,
      ref: o.ref,
      date: formatDate(o.createdAt, locale),
      status: o.status,
      total: formatMoney(
        o.finalPrice !== null ? Number(o.finalPrice) : o.estTotal !== null ? Number(o.estTotal) : null,
        afterReviewLabel,
      ),
    })),
  };
}

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const locale = await getAdminLocale();

  const tCommon = createTranslator(await getAdminMessages(locale), "adminCommon");

  let customer: CustomerDetailData | null;
  let loadFailed = false;
  try {
    customer = await loadCustomer(id, locale, tCommon("afterReview"));
  } catch (err) {
    console.error("AdminCustomerDetailPage: failed to load customer", err);
    customer = null;
    loadFailed = true;
  }

  if (!customer && !loadFailed) notFound();

  if (!customer) {
    return (
      <div className={pageStyles.page}>
        <div style={{ textAlign: "center", color: "#8A8070", fontSize: 13, padding: 40 }}>
          {tCommon("errorGeneric")}
        </div>
      </div>
    );
  }

  return (
    <div className={pageStyles.page}>
      <CustomerDetailView customer={customer} />
    </div>
  );
}
