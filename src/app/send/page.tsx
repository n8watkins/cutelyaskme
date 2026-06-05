import { SendInviteForm } from "@/components/SendInviteForm";

export default function SendPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl">✨</div>
          <h1 className="text-3xl font-black text-[#3a2530]">Plan a date</h1>
          <p className="mt-1 text-sm text-[#8a6a78]">
            Send an invite and let them pick what sounds good
          </p>
        </div>
        <SendInviteForm />
      </div>
    </main>
  );
}
