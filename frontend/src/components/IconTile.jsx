/**
 * Figma "Icon tile": a Lucide icon on a coloured square (decorative – the text next to it carries
 * the meaning). tone: orange | pink | sky | lilac; size: md (44 px) | lg (80 px).
 */
export default function IconTile({ icon: Icon, tone = 'orange', size = 'md' }) {
  return (
    <span className={`icon-tile icon-tile--${tone} ${size === 'lg' ? 'icon-tile--lg' : ''}`.trim()} aria-hidden="true">
      <Icon focusable="false" strokeWidth={2} />
    </span>
  );
}
