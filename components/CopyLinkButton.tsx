"use client";

export function CopyLinkButton({ token }: { token: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        navigator.clipboard.writeText(
          `${window.location.origin}/invite/${token}`,
        );
        e.currentTarget.textContent = "Copied!";
        setTimeout(() => {
          e.currentTarget.textContent = "Copy link";
        }, 1500);
      }}
      className="rounded-full border-2 border-[#ffd6e8] px-3 py-1 text-xs font-black text-[#8a6a78]"
    >
      Copy link
    </button>
  );
}
