import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { CampaignService } from "@/lib/services/campaign-service";

export default async function EditEmailTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaignService = new CampaignService();
  const template = await campaignService.getTemplate(id);

  if (!template) {
    notFound();
  }

  // For now, redirect to the template detail page
  // The EmailTemplateForm component needs to be enhanced to support editing
  redirect(`/email-templates/${id}`);
}
