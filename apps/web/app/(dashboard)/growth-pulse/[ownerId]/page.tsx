import { SellerDetail } from "@/components/growth-pulse/seller/seller-detail";

interface SellerDetailPageProps {
  params: Promise<{ ownerId: string }>;
}

export default async function SellerDetailPage({ params }: SellerDetailPageProps) {
  const { ownerId } = await params;

  return (
    <div className="space-y-6">
      <SellerDetail ownerId={ownerId} />
    </div>
  );
}
