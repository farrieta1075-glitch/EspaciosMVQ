import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/index";

export default async function HomePage() {
  const session = await auth();
  redirect(session ? "/calendario" : "/login");
}
