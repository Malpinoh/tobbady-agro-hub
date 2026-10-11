import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { FileText, Upload } from "lucide-react";
import { PageHeader, Panel, RequirePermission } from "@/components/app/PageKit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/board-documents")({
  head: () => ({
    meta: [
      { title: "Board Documents — TOBADDY AGRO LIVESTOCK" },
      { name: "description", content: "Upload documents for authorized executive review." },
    ],
  }),
  component: BoardDocumentsUpload,
});

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg";

function BoardDocumentsUpload() {
  const { can } = useAuth();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Meeting minutes");
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!can("documents.manage")) throw new Error("You do not have permission to upload documents.");
      if (!file) throw new Error("Choose a file to upload.");
      if (file.size > MAX_FILE_SIZE) throw new Error("Files must be 20 MB or smaller.");
      if (!title.trim()) throw new Error("Enter a document title.");

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Please sign in before uploading a document.");

      const safeName = file.name.normalize("NFKD")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/^_+|_+$/g, "") || "document";
      const filePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: storageError } = await supabase.storage
        .from("board-documents")
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (storageError) throw storageError;

      const { error: metadataError } = await supabase.from("documents").insert({
        title: title.trim(),
        category,
        file_path: filePath,
        uploaded_by: user.id,
      });
      if (metadataError) {
        await supabase.storage.from("board-documents").remove([filePath]);
        throw metadataError;
      }
      return title.trim();
    },
    onSuccess: () => {
      setTitle("");
      setCategory("Meeting minutes");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    },
  });

  return (
    <RequirePermission perm="documents.manage">
      <div className="space-y-6">
        <PageHeader
          title="Board Documents"
          description="Upload board records securely. Only the CEO and Administrator can view and download the document library."
        />
        <Panel title="Upload a document">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              uploadMutation.mutate();
            }}
          >
            <div className="flex items-start gap-3">
              <FileText className="mt-1 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Private document upload</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Files are stored in the private board-documents bucket. Maximum file size: 20 MB.
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium">
                Document title
                <Input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} placeholder="e.g. Board meeting minutes — October" />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Category
                <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm font-normal">
                  <option value="Meeting minutes">Meeting minutes</option>
                  <option value="Board resolutions">Board resolutions</option>
                  <option value="Strategic plans">Strategic plans</option>
                  <option value="Financial reports">Financial reports</option>
                  <option value="Other">Other</option>
                </select>
              </label>
            </div>
            <label className="block space-y-1.5 text-sm font-medium">
              Choose file
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                required
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  setFile(selected);
                  if (selected && !title.trim()) setTitle(selected.name.replace(/\.[^.]+$/, ""));
                }}
                className="block w-full rounded-md border bg-background px-3 py-2 text-sm font-normal"
              />
            </label>
            {file && file.size > MAX_FILE_SIZE && (
              <p className="text-sm text-destructive">This file is larger than 20 MB. Please choose a smaller file.</p>
            )}
            {uploadMutation.isError && (
              <p role="alert" className="text-sm text-destructive">Upload failed: {uploadMutation.error.message}</p>
            )}
            {uploadMutation.isSuccess && (
              <p role="status" className="text-sm text-primary">“{uploadMutation.data}” uploaded successfully.</p>
            )}
            <Button type="submit" disabled={!file || !title.trim() || file.size > MAX_FILE_SIZE || uploadMutation.isPending}>
              <Upload className="mr-2 h-4 w-4" />
              {uploadMutation.isPending ? "Uploading..." : "Upload document"}
            </Button>
          </form>
        </Panel>
      </div>
    </RequirePermission>
  );
}
