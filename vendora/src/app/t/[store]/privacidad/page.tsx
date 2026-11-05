import { LegalPage } from "@/components/store/legal-page";

export default async function Page({ params }: { params: Promise<{ store: string }> }) {
  return <LegalPage storeParam={(await params).store} kind="privacy" />;
}
