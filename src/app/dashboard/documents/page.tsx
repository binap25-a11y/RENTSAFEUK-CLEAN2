import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function DocumentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            A secure repository for all your property-related documents. This is a placeholder page.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
