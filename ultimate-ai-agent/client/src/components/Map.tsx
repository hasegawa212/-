interface MapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  markers?: Array<{ lat: number; lng: number; label?: string }>;
  className?: string;
}

export default function Map({
  latitude,
  longitude,
  zoom = 13,
  className = "",
}: MapProps) {
  // OpenStreetMap embed as a lightweight alternative to Google Maps
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01},${latitude - 0.01},${longitude + 0.01},${latitude + 0.01}&layer=mapnik&marker=${latitude},${longitude}`;

  return (
    <div className={`rounded-lg overflow-hidden border ${className}`}>
      <iframe
        title="Map"
        src={src}
        width="100%"
        height="300"
        style={{ border: 0 }}
        loading="lazy"
      />
    </div>
  );
}
