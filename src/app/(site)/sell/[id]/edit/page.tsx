import { notFound } from "next/navigation";
import { ListingForm } from "@/components/sell/ListingForm";
import { PageTitle } from "@/components/ui/EmptyState";
import { paiseToRupeesInput } from "@/lib/format";
import { getCategories, getListing } from "@/lib/listings";
import { getInstitute, requireViewer } from "@/lib/session";

export const metadata = { title: "Edit listing" };

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer(`/sell/${id}/edit`);
  const listing = await getListing(id);
  if (!listing || listing.seller_id !== viewer.id || listing.removed_by_moderator) notFound();
  const [institute, categories] = await Promise.all([getInstitute(listing.institute_id), getCategories()]);
  if (!institute) notFound();

  return (
    <div className="container-page max-w-3xl py-8">
      <PageTitle title="Edit listing" subtitle={listing.title} />
      <ListingForm
        userId={viewer.id}
        listingId={listing.id}
        kind={listing.kind}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        offersEnabled={institute.settings.offers_enabled !== false}
        maxImages={institute.settings.max_images}
        isEdit
        instituteName={institute.display_name}
        initialPhotos={listing.images.map((i) => i.storage_path)}
        initial={{
          title: listing.title,
          category_id: listing.category_id,
          price: listing.price_paise ? paiseToRupeesInput(listing.price_paise) : "",
          is_free: listing.kind === "sale" && listing.price_paise === 0,
          condition: listing.condition as never,
          listing_type: listing.listing_type,
          negotiable: listing.negotiable,
          description: listing.description,
          brand: listing.brand ?? "",
          model: listing.model ?? "",
          purchase_date: listing.purchase_date ?? "",
          original_price: listing.original_price_paise ? paiseToRupeesInput(listing.original_price_paise) : "",
        }}
      />
    </div>
  );
}
