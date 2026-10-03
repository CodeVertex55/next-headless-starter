export function JsonLd({ data }: { data: object }) {
  // Escape "<" so content such as "</script>" cannot break out of the script tag.
  const json = JSON.stringify(data).replace(/</g, "\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
