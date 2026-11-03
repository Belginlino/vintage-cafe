export function Wordmark({ tone = "light", size = "md" }: { tone?: "light" | "dark"; size?: "md" | "lg" }) {
  const main = tone === "dark" ? "text-champagne" : "text-primary";
  const sub = tone === "dark" ? "text-gold" : "text-gold";
  const big = size === "lg";
  return (
    <div className="text-center leading-none">
      <div className={`font-display font-semibold tracking-[0.18em] ${main} ${big ? "text-5xl" : "text-2xl"}`}>VINTAGE</div>
      <div className={`font-display italic ${main} ${big ? "mt-1 text-3xl" : "text-lg"}`}>Cafe</div>
      <div className={`mx-auto my-1.5 flex items-center justify-center gap-2 ${sub}`}>
        <span className="h-px w-6 bg-current" />
        <span className="text-[8px]">◆</span>
        <span className="h-px w-6 bg-current" />
      </div>
      <div className={`font-display italic ${sub} ${big ? "text-lg" : "text-xs"}`}>Timeless Indulgence</div>
    </div>
  );
}
