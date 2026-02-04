
import { AdminClientDetails } from "@/components/admin-client-details";
import { getClientById, getClients } from "@/lib/clients";

export async function generateStaticParams() {
  const clients = await getClients();
 
  return clients.map((client) => ({
    id: client.id,
  }));
}

type ClientPageProps = {
    params: any;
};

export default async function ClientDetailPage({ params }: ClientPageProps) {
  const resolvedParams = await params;
  const client = await getClientById(resolvedParams.id as string);

  if (!client) {
    return <div>Client not found</div>;
  }

  return <AdminClientDetails initialClient={client} />;
}
