
import { getCorporateClientDetails } from "../actions";
import { format } from "date-fns";
import CorporateProfileView from "./CorporateProfileView";

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const client = await getCorporateClientDetails(id);

    if (!client) {
        return <div className="p-10 text-center text-muted">Client not found</div>;
    }

    return <CorporateProfileView client={client} />;
}
