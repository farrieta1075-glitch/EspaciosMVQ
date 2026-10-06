import { serveBlobFile } from "@/lib/storage/serve-blob-file";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  return serveBlobFile("resources", filename);
}
