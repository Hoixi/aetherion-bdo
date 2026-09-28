/**
 * Aetherion kurdu — markanın işareti.
 *
 * Önden bakan bir kurt kafası: geniş alın, dışa yatık kulaklar, daralan
 * çene. Çizgi kalınlığı ve 24'lük kutu, sitenin geri kalanındaki lucide
 * ikonlarıyla aynı; yan yana durduklarında aynı ailedenmiş gibi
 * görünüyor.
 *
 * 20 pikselin altında gözler çizilmiyor: o boyutta iki kısa çizgi
 * birbirine yapışıp lekeye dönüşüyor, siluet ise okunur kalıyor.
 */
export function Kurt({ size = 24, strokeWidth = 2.1, className, style, title }: {
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Verilirse erişilebilirlik adı olur; verilmezse süs sayılır */
  title?: string;
}) {
  const sade = size < 20;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
         className={className} style={style}
         role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <path d="M3.4 3.6 7.6 9c1.3-.5 2.8-.8 4.4-.8s3.1.3 4.4.8l4.2-5.4-.9 7c.7 2.6-.1 4.8-2.3 6.5l-2.1 1.6-1.4 1.7h-3.8l-1.4-1.7-2.1-1.6C4.4 15.4 3.6 13.2 4.3 10.6z" />
      {!sade && <path d="M9.7 12.6l1.4.9M14.3 12.6l-1.4.9" />}
    </svg>
  );
}
